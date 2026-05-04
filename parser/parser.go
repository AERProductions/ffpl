// Package parser is the public FFPL save-file parser.
//
// It extracts ACLoadout records from PPSSPP save states (.ppst) and decrypted
// Armored Core: Formula Front save files (SDDATA.BIN).
//
// This package is the community-auditable surface of the FFPL stack.
// It contains no server logic, no match-runner code, and no rating engine.
// Users can verify that their save data is read correctly and that no
// unexpected data is extracted or transmitted.
//
// Supported regions: US (ULUS-10034), JP (ULJS-19001), EU (ULES-00219).
package parser

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/klauspost/compress/zstd"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/transform"
)

// ─── AC struct byte offsets ────────────────────────────────────────────────
// All offsets are relative to the first byte of the 12-byte null-terminated
// AC name string (the "anchor").
//
// Positive offsets are forward (post-name data). Negative offsets are into the
// preceding AC slot's trailing area, which the game reuses for this AC's
// mobility parts.
//
// Verification source: binary-diff analysis across Defaults.bin/Modified.bin,
// AC_Garage.bin/AC_Garage_Twin.bin, and decompressed ULUS10034_1.02_0.ppst.
const (
	offHead       = 76  // uint16 LE – CONFIRMED
	offCore       = 78  // uint16 LE – CONFIRMED
	offArms       = 80  // uint16 LE – inferred
	offLegsStruct = 82  // uint16 LE – confirmed
	offBooster    = 84  // uint16 LE – CONFIRMED
	offFCS        = 86  // uint16 LE – CONFIRMED
	offGenerator  = 88  // uint16 LE – CONFIRMED
	offRadiator   = 90  // uint16 LE – CONFIRMED
	offInside     = 92  // uint16 LE – CONFIRMED
	offExtension  = 94  // uint16 LE – CONFIRMED
	offBackR      = 96  // uint16 LE – CONFIRMED
	offBackL      = 98  // uint16 LE – CONFIRMED
	offArmR       = 100 // uint16 LE – CONFIRMED
	offArmL       = 102 // uint16 LE – CONFIRMED
	offArmHangarR = 104 // uint16 LE – inferred hangar slot
	offArmHangarL = 106 // uint16 LE – inferred hangar slot
	offLegs       = -16 // uint16 LE – verified (sequential per-AC leg IDs across teams)

	acStructStride = 0x180 // bytes between consecutive ACs in a team (confirmed)
	acTeamSize     = 5     // 5 ACs per league team
	maxPartID      = 428   // covers JP International ceiling (427 parts)
)

// zstdMagic is the PPSSPP ZSTD frame header present in .ppst save states.
var zstdMagic = []byte{0x28, 0xB5, 0x2F, 0xFD}

// ─── Schema types ─────────────────────────────────────────────────────────

// IdentifierSchema is the anchor-string descriptor in ac_memory_schema.json.
type IdentifierSchema struct {
	AnchorString string `json:"anchor_string"`
	Encoding     string `json:"encoding"`
	Length       int    `json:"length"`
}

// ACStructSchema holds the per-field byte offsets from ac_memory_schema.json.
type ACStructSchema struct {
	Identifier           IdentifierSchema `json:"identifier"`
	LoadoutOffsets       map[string]int   `json:"loadout_offsets"`
	AIPerformanceOffsets map[string]int   `json:"ai_performance_offsets"`
	OperationsGrid       map[string]int   `json:"operations_grid"`
}

// SchemaWrapper is the top-level wrapper around ac_memory_schema.json.
type SchemaWrapper struct {
	ACStruct ACStructSchema `json:"ac_struct"`
}

// ─── Public types ──────────────────────────────────────────────────────────

// TeamColorScheme holds the four colour indices applied to all ACs in a team.
// Color indices for weapon (0=BLACK 1=RED 2=YELLOW 3=GREEN 4=BLUE 5=WHITE)
// and frame (0=RED 1=YELLOW, remaining 2–11 in display-grid order).
// CustomXXXBGRA overrides let the match runner patch the game's colour palette
// at match start. Format: packed LE uint32 = Blue|(Green<<8)|(Red<<16)|(Alpha<<24).
// nil (omitted from JSON) = use game default palette.
type TeamColorScheme struct {
	WeaponMain uint32 `json:"weapon_main"`
	WeaponSec  uint32 `json:"weapon_sec"`
	FrameMain  uint32 `json:"frame_main"`
	FrameSec   uint32 `json:"frame_sec"`

	CustomWeaponMainBGRA *uint32 `json:"custom_wm_bgra,omitempty"`
	CustomWeaponSecBGRA  *uint32 `json:"custom_ws_bgra,omitempty"`
	CustomFrameMainBGRA  *uint32 `json:"custom_fm_bgra,omitempty"`
	CustomFrameSecBGRA   *uint32 `json:"custom_fs_bgra,omitempty"`
}

// ACLoadout is a single verified AC build extracted from a save file.
// It is the canonical data type shared between the public parser and all
// FFPL backend services.
type ACLoadout struct {
	// ID is the PocketBase record ID — empty until pushed to the league server.
	ID string `json:"id"`
	// Profile is the AC pilot name as stored in the save (UTF-8 or decoded Shift-JIS).
	Profile string `json:"profile"`
	// AnchorHex is the raw byte offset of this AC in the source file (debug only).
	AnchorHex string `json:"anchorHex"`
	// TamperHash is a SHA-256 of the raw AC struct bytes — tamper-evident fingerprint.
	TamperHash string `json:"tamperHash"`
	// Region is "US" or "JP" depending on the detected game ID in the save.
	Region string `json:"region"`
	// PartHashes maps slot names ("Head", "Core", "Legs", …) to their internal part IDs.
	PartHashes map[string]uint16 `json:"part_hashes"`
	// AIPerformance maps AI tuning slider names to their 0–100 values.
	AIPerformance map[string]uint8 `json:"ai_performance"`
	// OperationsGrid is the 6×6 AI logic chip grid.
	OperationsGrid [][]string `json:"operations_grid"`
	// ColorScheme holds the team colour selection; nil means use the game default.
	ColorScheme *TeamColorScheme `json:"color_scheme,omitempty"`
}

// ChipDictionary maps raw chip byte values to human-readable chip names.
// Source: Starter_Chips.bin dictionary.
var ChipDictionary = map[uint8]string{
	1:  "WEP-1",
	6:  "NAT-1",
	10: "ATF-4",
	14: "MOS-1",
	32: "ATB-1",
	42: "WEC-1",
}

// ─── Internal helpers ──────────────────────────────────────────────────────

func readU16LE(data []byte, offset int) uint16 {
	return binary.LittleEndian.Uint16(data[offset : offset+2])
}

func isValidRequiredPartID(id uint16) bool {
	return id > 0 && id < maxPartID
}

func extractOneAC(data []byte, anchor int) (ACLoadout, bool) {
	if anchor < 16 || anchor+108 >= len(data) {
		return ACLoadout{}, false
	}
	core := readU16LE(data, anchor+offCore)
	legs := readU16LE(data, anchor+offLegs)
	if !isValidRequiredPartID(core) || !isValidRequiredPartID(legs) {
		return ACLoadout{}, false
	}
	legsStruct := readU16LE(data, anchor+offLegsStruct)
	gen := readU16LE(data, anchor+offGenerator)
	if legsStruct == 0 || legsStruct >= maxPartID || gen == 0 || gen >= maxPartID {
		return ACLoadout{}, false
	}

	hashStart := anchor - 16
	if hashStart < 0 {
		hashStart = 0
	}
	hashEnd := anchor + acStructStride
	if hashEnd > len(data) {
		hashEnd = len(data)
	}
	rawHash := sha256.Sum256(data[hashStart:hashEnd])

	nameLen := 0
	for nameLen < 12 && data[anchor+nameLen] != 0 {
		nameLen++
	}
	nameRaw := data[anchor : anchor+nameLen]
	isShiftJIS := false
	for _, b := range nameRaw {
		if (b >= 0x81 && b <= 0x9F) || (b >= 0xE0 && b <= 0xFC) {
			isShiftJIS = true
			break
		}
	}
	var profileName string
	if isShiftJIS {
		profileName = decodeShiftJIS(nameRaw)
	} else {
		profileName = string(nameRaw)
	}

	return ACLoadout{
		Profile:    profileName,
		AnchorHex:  fmt.Sprintf("0x%x", anchor),
		TamperHash: hex.EncodeToString(rawHash[:]),
		PartHashes: map[string]uint16{
			"Head":         readU16LE(data, anchor+offHead),
			"Core":         core,
			"Arms":         readU16LE(data, anchor+offArms),
			"Legs":         legs,
			"Booster":      readU16LE(data, anchor+offBooster),
			"FCS":          readU16LE(data, anchor+offFCS),
			"Generator":    readU16LE(data, anchor+offGenerator),
			"Radiator":     readU16LE(data, anchor+offRadiator),
			"Legs_Struct":  readU16LE(data, anchor+offLegsStruct),
			"Inside":       readU16LE(data, anchor+offInside),
			"Extension":    readU16LE(data, anchor+offExtension),
			"Back_R":       readU16LE(data, anchor+offBackR),
			"Back_L":       readU16LE(data, anchor+offBackL),
			"Arm_R":        readU16LE(data, anchor+offArmR),
			"Arm_L":        readU16LE(data, anchor+offArmL),
			"Arm_R_Hangar": readU16LE(data, anchor+offArmHangarR),
			"Arm_L_Hangar": readU16LE(data, anchor+offArmHangarL),
		},
		AIPerformance:  make(map[string]uint8),
		OperationsGrid: make([][]string, 0),
	}, true
}

func tryTeamAt(data []byte, start, end int) []ACLoadout {
	if end > len(data) {
		end = len(data)
	}
	maxAnchor := end - acTeamSize*acStructStride
	for anchor := start; anchor < maxAnchor; anchor += 4 {
		if anchor < 16 || anchor+offCore+2 >= len(data) {
			continue
		}
		core := readU16LE(data, anchor+offCore)
		legs := readU16LE(data, anchor+offLegs)
		if !isValidRequiredPartID(core) || !isValidRequiredPartID(legs) {
			continue
		}
		team := make([]ACLoadout, 0, acTeamSize)
		valid := true
		for i := 0; i < acTeamSize; i++ {
			ac, ok := extractOneAC(data, anchor+i*acStructStride)
			if !ok {
				valid = false
				break
			}
			team = append(team, ac)
		}
		if valid {
			return team
		}
	}
	return nil
}

func scanForTeam(data []byte) ([]ACLoadout, error) {
	knownRanges := [][2]int{
		{0x01024000, 0x01028000},
		{0x12CA000, 0x12CE000},
		{0x820000, 0x830000},
		{0x17FC000, 0x17FF000},
		{0xACA000, 0xACB000},
		{0xB12000, 0xB14000},
		{0xC15000, 0xC17000},
	}
	for _, r := range knownRanges {
		if team := tryTeamAt(data, r[0], r[1]); len(team) == acTeamSize {
			fmt.Printf("[FFPL Parser] Team found at known range 0x%x.\n", r[0])
			return team, nil
		}
	}
	if team := tryTeamAt(data, 40, len(data)); len(team) == acTeamSize {
		fmt.Printf("[FFPL Parser] Team found via full scan.\n")
		return team, nil
	}
	return nil, fmt.Errorf("no valid 5-AC team found in save data")
}

func maybeDecompressZSTD(data []byte) ([]byte, error) {
	idx := bytes.Index(data, zstdMagic)
	if idx == -1 {
		return data, nil
	}
	dec, err := zstd.NewReader(bytes.NewReader(data[idx:]))
	if err != nil {
		return nil, fmt.Errorf("zstd reader init: %w", err)
	}
	defer dec.Close()
	out, err := io.ReadAll(dec)
	if err != nil {
		return nil, fmt.Errorf("zstd decompress: %w", err)
	}
	return out, nil
}

// detectRegion returns "EU", "JP", or "US" based on game ID strings embedded
// in the decompressed PSP RAM dump.
// EU binary (ULES00219) embeds both "ULES" and "ULJS" — check ULES first.
func detectRegion(unpacked []byte) string {
	if bytes.Contains(unpacked, []byte("ULES")) {
		return "EU"
	}
	if bytes.Contains(unpacked, []byte("ULJS")) {
		return "JP"
	}
	return "US"
}

func decodeShiftJIS(b []byte) string {
	decoder := japanese.ShiftJIS.NewDecoder()
	out, _, err := transform.Bytes(decoder, b)
	if err != nil {
		return string(b)
	}
	return string(out)
}

// ─── Public API ────────────────────────────────────────────────────────────

// ParseSDDATARaw is the primary entry point for user-supplied save data.
// It accepts both raw .ppst (ZSTD-compressed PPSSPP save states) and
// decrypted SDDATA.BIN files (via Apollo Save Tool / SaveDeemer).
// schemaBytes is the contents of data/ac_memory_schema.json.
func ParseSDDATARaw(data []byte, schemaBytes []byte) ([]ACLoadout, error) {
	unpacked, err := maybeDecompressZSTD(data)
	if err != nil {
		return nil, fmt.Errorf("decompression error: %w", err)
	}
	region := detectRegion(unpacked)
	fmt.Printf("[FFPL Parser] Detected region: %s\n", region)

	const largeThreshold = 5 * 1024 * 1024
	if len(unpacked) >= largeThreshold {
		loadouts, err := scanForTeam(unpacked)
		if err != nil {
			return nil, err
		}
		for i := range loadouts {
			loadouts[i].Region = region
		}
		fmt.Printf("[FFPL Parser] Positional scan extracted %d AC loadouts.\n", len(loadouts))
		return loadouts, nil
	}

	var schema SchemaWrapper
	if err := json.Unmarshal(schemaBytes, &schema); err != nil {
		return nil, fmt.Errorf("schema parse error: %w", err)
	}
	return extractByFormulaFScan(unpacked, &schema)
}

func extractByFormulaFScan(data []byte, schema *SchemaWrapper) ([]ACLoadout, error) {
	acStruct := schema.ACStruct
	anchorBytes := []byte(acStruct.Identifier.AnchorString)
	opsGridOffset := 38900
	if val, ok := acStruct.OperationsGrid["ac1_offset"]; ok {
		opsGridOffset = val
	}

	var extracted []ACLoadout
	offset := 0
	for {
		idx := bytes.Index(data[offset:], anchorBytes)
		if idx == -1 {
			break
		}
		absoluteIdx := offset + idx
		offset = absoluteIdx + len(anchorBytes)

		nameBytes := bytes.TrimRight(data[absoluteIdx:absoluteIdx+12], "\x00")
		ac := ACLoadout{
			Profile:        string(nameBytes),
			AnchorHex:      fmt.Sprintf("0x%x", absoluteIdx),
			PartHashes:     make(map[string]uint16),
			AIPerformance:  make(map[string]uint8),
			OperationsGrid: make([][]string, 0, 6),
		}

		valid := true
		for partKey, relativeOffset := range acStruct.LoadoutOffsets {
			addr := absoluteIdx + relativeOffset
			if addr < 0 || addr+2 > len(data) {
				valid = false
				break
			}
			ac.PartHashes[partKey] = binary.LittleEndian.Uint16(data[addr : addr+2])
		}
		if !valid {
			continue
		}

		for statKey, relativeOffset := range acStruct.AIPerformanceOffsets {
			addr := absoluteIdx + relativeOffset
			if addr >= 0 && addr < len(data) {
				ac.AIPerformance[statKey] = data[addr]
			}
		}

		gridAddr := absoluteIdx + opsGridOffset
		if gridAddr >= 0 && gridAddr+36 <= len(data) {
			for row := 0; row < 6; row++ {
				var rowCells []string
				for col := 0; col < 6; col++ {
					addr := gridAddr + (row*6 + col)
					chipVal := data[addr]
					chipName := "---"
					if chipVal > 0 {
						if mappedName, exists := ChipDictionary[chipVal]; exists {
							chipName = mappedName
						} else {
							chipName = fmt.Sprintf("Chip_%d", chipVal)
						}
					}
					rowCells = append(rowCells, chipName)
				}
				ac.OperationsGrid = append(ac.OperationsGrid, rowCells)
			}
		}
		extracted = append(extracted, ac)
	}

	fmt.Printf("[FFPL Parser] FORMULA F scan extracted %d AC loadouts.\n", len(extracted))
	return extracted, nil
}

// ParseSDDATA is the file-path convenience wrapper around ParseSDDATARaw.
// binPath is the path to the save file; schemaPath is the path to
// data/ac_memory_schema.json.
func ParseSDDATA(binPath string, schemaPath string) ([]ACLoadout, error) {
	data, err := os.ReadFile(binPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read bin file: %v", err)
	}
	schemaBytes, err := os.ReadFile(schemaPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read schema: %v", err)
	}
	return ParseSDDATARaw(data, schemaBytes)
}

package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/AERProductions/ffpl/backend"

	runtime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Start the HTTP parse server alongside the Wails app so the web HQ can
	// also submit save files without installing the desktop client.
	go startParseServer()
}

func (a *App) Ping() string {
	return "FFPL Backend Acknowledged. Connection Active."
}

// ProcessSaveData ingests the raw byte array decrypted natively in the browser via WASM
// It parses the array and pushes to the Pocketbase Architect Profile.
// userID is the PocketBase users record ID of the uploading Architect (empty string = anonymous).
func (a *App) ProcessSaveData(base64Data, userID string) ([]backend.ACLoadout, error) {
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64 save data: %v", err)
	}

	schemaBytes, err := EmbeddedData.ReadFile("data/ac_memory_schema.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded schema: %v", err)
	}

	partsDbBytes, err := EmbeddedData.ReadFile("ffpl-hq/src/data/parts_db.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded parts_db: %v", err)
	}
	jpPartsDbBytes, err := EmbeddedData.ReadFile("ffpl-hq/src/data/jp_parts_db.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded jp_parts_db: %v", err)
	}

	fmt.Printf("Received %d bytes of raw save data from frontend WASM engine\n", len(data))

	loadouts, err := backend.ParseSDDATARaw(data, schemaBytes)
	if err != nil {
		return nil, fmt.Errorf("Parser engine error: %v", err)
	}

	for _, loadout := range loadouts {
		dbBytes := partsDbBytes
		if loadout.Region == "JP" {
			dbBytes = jpPartsDbBytes
		}
		if vErr := backend.ValidateLoadout(loadout, dbBytes); vErr != nil {
			fmt.Printf("SECURITY HALT: %v\n", vErr)
			return nil, fmt.Errorf("CHEAT DETECTED: Illegal Loadout")
		}
	}
	fmt.Println("DATA.BIN Database verification Check Passed.")

	// Derive team name from the first AC's profile (save-file sourced).
	// Falls back to "FFPLTEAM" if the save has no profile name set.
	teamName := "FFPLTEAM"
	if len(loadouts) > 0 && loadouts[0].Profile != "" {
		teamName = loadouts[0].Profile
	}
	err = backend.PushLoadoutsToPocketBase(loadouts, teamName, userID)
	if err != nil {
		fmt.Printf("Warning: Database Sync Failed: %v\n", err)
		// We still return loadouts to frontend even if pocketbase failed
	} else {
		fmt.Println("Successfully pushed AC Loadouts to PocketBase.")
	}

	return loadouts, nil
}

// TestMatchmaker queues a headless battle between two PocketBase AC Loadout profiles
// using the full PPSSPP match pipeline. Both loadouts must already exist in PocketBase
// (p1.ID and p2.ID are populated when loadouts are fetched from the HQ site).
func (a *App) TestMatchmaker(p1 backend.ACLoadout, p2 backend.ACLoadout) error {
	if p1.ID == "" || p2.ID == "" {
		return fmt.Errorf("both loadouts must have a PocketBase ID (got %q vs %q)", p1.ID, p2.ID)
	}
	matchID := fmt.Sprintf("test-%d", time.Now().UnixMilli())
	fmt.Printf("[FFPL HQ] Test match %s: %q vs %q\n", matchID, p1.Profile, p2.Profile)
	go func() {
		winner, replayURL, _, err := runFFMatch(p1.ID, p2.ID, matchID, 0, "5v5") // 0 = use template stage
		if err != nil {
			fmt.Printf("[FFPL HQ] Test match %s error: %v\n", matchID, err)
			result, _ := json.Marshal(map[string]any{"matchID": matchID, "error": err.Error()})
			runtime.EventsEmit(a.ctx, "ffpl:match_result", string(result))
			return
		}
		fmt.Printf("[FFPL HQ] Test match %s complete \u2014 winner: %s  replay: %s\n", matchID, winner, replayURL)
		result, _ := json.Marshal(map[string]any{
			"matchID":        matchID,
			"winnerID":       winner,
			"challengerID":   p1.ID,
			"challengerName": p1.Profile,
			"defenderID":     p2.ID,
			"defenderName":   p2.Profile,
			"replayURL":      replayURL,
		})
		runtime.EventsEmit(a.ctx, "ffpl:match_result", string(result))
	}()
	return nil
}

// ExportColorSave patches T1 and T2 color data (weapon indices and/or per-AC
// body RGB) into the AC TEST template save (slot 0) for the given region and
// writes the patched result to outputSlot.
//
// region must be "JP" (ULJS19001_1.00) or "US" (ULUS10034_1.02).
//
// In each PPSTColorScheme:
//   - WeaponColors[i] = -1  → leave that AC's weapon color unchanged.
//   - WeaponColors[i] = 0–5 → color index (0=black 1=red 2=yellow 3=green 4=blue 5=white).
//   - RGBBlocks[i]    = nil → leave that AC's body RGB unchanged.
//
// The patched .ppst is written to:
//
//	<workspace>/ppsspp/memstick/PSP/PPSSPP_STATE/<romID>_<outputSlot>.ppst
//
// Load that slot in PPSSPP to see the colors applied from frame 1.
func (a *App) ExportColorSave(region string, t1 backend.PPSTColorScheme, t2 backend.PPSTColorScheme, outputSlot int) error {
	if outputSlot < 0 || outputSlot > 9 {
		return fmt.Errorf("outputSlot %d out of range [0,9]", outputSlot)
	}
	if outputSlot == 0 {
		return fmt.Errorf("outputSlot 0 is the template — choose a different slot (1-9)")
	}

	var romID string
	switch region {
	case "JP":
		romID = "ULJS19001_1.00"
	case "US":
		romID = "ULUS10034_1.02"
	default:
		return fmt.Errorf("ExportColorSave: unsupported region %q (expected \"JP\" or \"US\")", region)
	}

	// Resolve workspace root the same way runFFMatch does.
	workspaceRoot, _ := os.Getwd()
	if _, err := os.Stat(filepath.Join(workspaceRoot, "ppsspp")); err != nil {
		if exe, err := os.Executable(); err == nil {
			workspaceRoot = filepath.Dir(exe)
		}
	}

	stateDir := filepath.Join(workspaceRoot, "ppsspp", "memstick", "PSP", "PPSSPP_STATE")
	slotPath := func(slot int) string {
		return filepath.Join(stateDir, fmt.Sprintf("%s_%d.ppst", romID, slot))
	}

	// Read the AC TEST pre-battle template (slot 0) for this region.
	templateBytes, err := os.ReadFile(slotPath(0))
	if err != nil {
		return fmt.Errorf("ExportColorSave: read template slot 0: %w", err)
	}

	patched, err := backend.PatchPPSTColors(templateBytes, t1, t2, region)
	if err != nil {
		return fmt.Errorf("ExportColorSave: patch: %w", err)
	}

	outPath := slotPath(outputSlot)
	if err := os.WriteFile(outPath, patched, 0644); err != nil {
		return fmt.Errorf("ExportColorSave: write slot %d: %w", outputSlot, err)
	}

	fmt.Printf("[FFPL HQ] Color save written → %s\n", outPath)
	return nil
}

// TileSpectatorWindows arranges all running PPSSPP instances into a grid on the
// primary monitor.  Call this from the HQ UI after dispatching a team match to
// get a live tiled spectator view of all 5 rounds simultaneously.
func (a *App) TileSpectatorWindows() (string, error) {
	return backend.TileSpectatorWindows()
}

// CaptureACPreview sends F12 to the user's local PPSSPP window, waits for the
// PNG to be written, and returns it as a base64-encoded string.
//
// This is a user-facing tool — any Architect can call it to snapshot their own
// AC from a locally running PPSSPP instance.  It does NOT require Commissioner
// access.  The caller can display the result as:
//
//	<img src={`data:image/png;base64,${result}`} />
func (a *App) CaptureACPreview() (string, error) {
	workspaceRoot, _ := os.Getwd()
	if _, err := os.Stat(filepath.Join(workspaceRoot, "ppsspp")); err != nil {
		if exe, err := os.Executable(); err == nil {
			workspaceRoot = filepath.Dir(exe)
		}
	}
	return backend.CaptureScreenshot(workspaceRoot)
}

// resolveWorkspaceRoot returns the workspace root (consistent with match runner).
func (a *App) resolveWorkspaceRoot() string {
	root, _ := os.Getwd()
	if _, err := os.Stat(filepath.Join(root, "ppsspp")); err != nil {
		if exe, err := os.Executable(); err == nil {
			return filepath.Dir(exe)
		}
	}
	return root
}

// IsCommissioner checks whether email is in commissioners.json.
// Returns true if the user should have operator access regardless of their
// PocketBase role field (useful when the PB admin UI doesn't expose role editing).
func (a *App) IsCommissioner(email string) (bool, error) {
	return backend.IsCommissioner(email, a.resolveWorkspaceRoot())
}

// AddCommissioner appends email to commissioners.json.
func (a *App) AddCommissioner(email string) error {
	return backend.AddCommissioner(email, a.resolveWorkspaceRoot())
}

// RemoveCommissioner removes email from commissioners.json.
func (a *App) RemoveCommissioner(email string) error {
	return backend.RemoveCommissioner(email, a.resolveWorkspaceRoot())
}

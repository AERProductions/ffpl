# FFPL Roadmap

Status: Active development — core pipeline operational, live league server deployed.
Website live at ffplhq.com (Hostinger). Desktop client published to GitHub Releases.
Outstanding work is split between platform completeness, feature gaps, and ecosystem expansion.

---

## Completed

### Save File Engine
- US (ULUS-10061) and JP (ULJS-19001) save parsing — `ParseSDDATA` / `ParseSDDATARaw`
- ZSTD decompression, Shift-JIS AC name decoding
- Team scan heuristics (`scanForTeam`) — works on both raw and Apollo-exported DATA.BIN
- Loadout fingerprint tamper detection — direct injection rejected at parse time
- Parts DB validator — covers full US+JP frame ID space (0–386); JP-exclusive weapon/option parts (387–427) pass range check but are not yet named in `parts_db.json`

### Match Pipeline (`backend/match_runner.go` — 1985 lines)
- 5v5 team match execution (`RunFFTeamMatch`) — 5 parallel PPSSPP instances, one per round pairing
- Per-round isolated memstick/state directories (`ensureRoundInstance`)
- Save state injection — PPST writer writes AC loadouts directly into `.ppst` slot files before PPSSPP boots
- JSON-RPC memory read/write (`ppssppMemRead` / `ppssppMemWrite`) — no process attachment
- Arena unlock injection, stage override via memory write
- T1 color scheme injection (frame + weapon palettes, confirmed VAs)
- Replay file capture and upload to PocketBase (`uploadReplayFile`)
- Battle end detection via Win32 RAM monitor (`WaitForBattleEnd`)
- Glicko-2 ratings updated on match completion

### Rating Engine
- Full Glicko-2 implementation (`Glicko2Update`) — rating, deviation, volatility
- Admin endpoint to bulk recalculate all ratings (`/admin/ratings/recalculate`)

### HTTP Server (`:8091`)
| Route | Method | Auth |
|---|---|---|
| `/parse-save` | POST | API key |
| `/queue-match` | POST | API key |
| `/queue-status` | GET | API key |
| `/submit-client-match` | POST | HMAC match token |
| `/health` | GET | none |
| `/commissioner/events` | GET/POST | Commissioner key |
| `/commissioner/events/{id}/…` | GET/POST | Commissioner key (owns event) |
| `/admin/events` | GET/POST | Admin key |
| `/admin/matches/{id}` | GET/POST | Admin key |
| `/admin/queue` | GET | Admin key |
| `/admin/commissioners` | GET/POST/DELETE | Admin key |
| `/admin/ratings/recalculate` | POST | Admin key |

### Auth
- Admin key (`FFPL_ADMIN_KEY`) — separate from API key, falls back gracefully
- Commissioner license system — license files per pilot, ownership check per event
- HMAC match token (`FFPL_MATCH_SECRET`) — `IssueClientMatch` / `VerifyClientSubmission`

### Client Execution Mode
- Server issues a signed PPST blob + HMAC token to the requesting client
- Client runs the match locally (Architect Nexus), submits result PPST via `/submit-client-match`
- Server verifies token + AP values from result PPST, determines winner

### Desktop App (Wails + React)
- **LeaderboardPage** — live standings with Glicko-2 ±RD display, challenge send/respond, incoming challenge panel
- **HangarPage** — AC loadout management, test match runner, per-AC preview capture (F12 → PB upload), spectator window tiling
- **ProfilePage** — challenge mode (open / vacation / closed / ascending / descending), vacation expiry date, replay visibility toggle
- **CommissionerPage** — event management, pairings upload, batch match dispatch ("burn"), pilot broadcast
- **CalendarPage** — event creation (tournament / qualifier / other types)
- Wails shims for both desktop and web deployment paths

### Deployment (Linux)
- `server_main.go` — standalone CGo-free server entry point (`//go:build !wails`)
- `embedded.go` — schema embeds available in non-Wails builds
- `FFPL_PPSSPP_EXE` env var — path override for Linux AppImage
- `backend/ram_monitor_linux.go` — Linux `sendStartKey` (xdotool) + `WaitForBattleEnd` (/proc/pid/mem scan)
- `backend/ram_monitor.go` + `backend/spectator.go` gated `//go:build windows` — Linux cross-compile clean
- `deploy/systemd/` — `ffpl-server.service` + `ffpl-pocketbase.service` with xvfb dependency hooks
- `deploy/nginx/` — reverse proxy config
- `deploy/server.env.template` — full production env var template

### Live Deployment
- Website deployed to Hostinger — ffplhq.com (landing), ffplhq.com/hq/ (League HQ), ffplhq.com/nexus/ (web client)
- Desktop client (Architect Nexus) published to GitHub Releases
- PocketBase backend live with migrations applied

---

## In Progress

*(Nothing currently in flight — see Planned below.)*

---

## Planned

### P1 — Core Correctness

**Cooldown & Anti-Padding Enforcement**
Documented in README (7-day per-matchup cooldown, one active outgoing challenge at a time) but not implemented in `handleQueueMatch`. PocketBase query needed before queuing to check:
- Whether a challenge between these two pilots ran in the last 7 days
- Whether the challenger already has an active outgoing challenge

**JP Parts DB — Weapon/Option Slot Names (IDs 387–427)**
The validator accepts these IDs but `parts_db.json` has no names for them. Affects the HQ parts display for JP-exclusive builds.

### P2 — Platform Expansion

**EU Region (ULES-00219) — COMPLETE**
PAL copy confirmed in-hand. Full calibration run on 2026-05-03 using slot 0 + slot 3 AC TEST PPST diff.

Confirmed via `_scripts/calibrate_eu.go` + `_scripts/validate_eu_teams.go`:
- `playerTeamBase = 0x0102402C` — identical to US/JP (validated: "FORMULA F 01–05" at exact acStride spacing)
- `cpuTeamBase = 0x012CAEA4` — identical to US/JP (same team data, validated 5-AC stride alignment)
- Color VAs — EU uses same addresses as US (confirmed by PPST diff: RGB T2 copy-A/B changed at 0x08824050/0x08C34820, T2 weapon at US addresses 0x097F66E4/0x090F0DD0)
- `detectRegion()` updated in `backend/acParser.go` + `parser/parser.go`: checks "ULES" before "ULJS" (EU binary embeds both strings)
- `isoFileName("EU")` / `gameIniFileName("EU")` added to `match_runner.go`
- `PatchPPSTColors` accepts "EU" (falls through to US color paths — confirmed correct)
- `InjectMatchTeams` correctly sets `isJP = false` for EU (guards EU before ULJS check)

**Remaining EU work:** End-to-end match run on physical EU ROM to confirm AP monitoring VAs.

**Match History UI**
Replays are captured and uploaded to PocketBase. There is no page in the HQ app to browse past matches, view round results, or play replay files. Requires a new `MatchHistoryPage` pulling from the `matches` PB collection.

**Replay Viewer Integration**
`.dat` PPSSPP replay files are stored in PocketBase. Either:
- Provide a download link + instructions (load via PPSSPP File menu), or
- Embed a PPSSPP WebAssembly build for in-browser replay playback (long-term)

### P3 — Ecosystem

**arch-nexus-web — Full Web Client**
Currently contains only a save upload flow (`App.jsx`, `decryptSave.js`, `staticData.js`).
The Wails desktop app has feature parity the web client lacks entirely:
- Leaderboard with challenge buttons
- Profile management (challenge mode, vacation, replay visibility)
- Match history
Target: parity with `ffpl-hq` for pilots who don't want to install the desktop app.

**Notification / Webhook System**
No push mechanism exists for match results. Pilots currently discover outcomes by polling PocketBase directly or checking the leaderboard.
Options: PocketBase hooks → Discord webhook, email on result, or SSE stream from the Go server.

**Rating Seasons**
Admin has a bulk recalculate endpoint but no concept of competitive seasons — no start/end dates, no season archive, no rating soft-reset between seasons. Needed before running a first official split.

**Public Parser Package Documentation**
`parser/` is a standalone importable Go package (`github.com/AERProductions/ffpl/parser`) referenced in the README for community tooling, but has no `README.md`, no documented API, and no usage examples.

**European Save Upload Path**
Once ULES region detection lands, the desktop app needs to handle EU saves correctly end-to-end: parse, validate, submit.

---

## Deferred / Research

| Item | Blocker |
|---|---|
| Double-elimination bracket generation | Commissioner API only supports manual pairings upload today |
| Live AP streaming overlay during server matches | Requires Xvfb screenshot pipe or PPSSPP render hook |
| AC stat override for sanctioned balance events | `injectCustomStats` is implemented in match_runner; needs commissioner UI toggle + admin safeguard |
| ULES-00622 palette VA calibration | No EU ROM dump access yet |
| WebAssembly replay viewer | Size / compatibility unknown |

# Formula Front Pro League

> **The only automated, ranked competitive circuit for *Armored Core: Formula Front — Extreme Battle* on PSP.**

Build your unmanned AC. Upload your save. Let your AI pilot fight for you.

---

## What is FFPL?

Formula Front Pro League is an asynchronous mecha combat league built around PSP's *Armored Core: Formula Front — Extreme Battle* — the only game in the series where you program your AC's AI and send it into battle without touching a controller.

You design the machine. You train the AI. Then you step back and watch it win or lose on its own merits.

FFPL wraps that premise in a full competitive structure:

- **Verified loadouts** — your AC is extracted directly from your PSP or PPSSPP save file and cryptographically hashed, so no manual entry and no cheating
- **Glicko-2 rated ladder** — rating, deviation, and volatility update after every sanctioned result
- **Asynchronous matchmaking** — challenge any pilot on the leaderboard; the match runs automatically on the league server and you get the result and replay link whenever it finishes
- **Commissioner-sanctioned events** — licensed commissioners run tournaments and arbitrate disputes through the HQ tools
- **Full replay archive** — every match is captured; you control whether yours are public

---

## How to Compete

### 1 — Get Architect Nexus

Download the **Architect Nexus** desktop client from the [Releases page](https://github.com/AERProductions/ffpl/releases/latest).

Architect Nexus is the desktop tool that reads your save file, verifies your loadout, and connects you to the FFPL league server — you never touch the server directly.

Save files from real PSP hardware and PPSSPP are both supported.

> A web client is also available at [ffplhq.com/hq/](https://ffplhq.com/hq/) — no install required for browsing standings and issuing challenges.

### 2 — Sync Your AC

1. Save your team in-game on real PSP hardware or in PPSSPP.
2. Drop the save file into Architect Nexus (or point it at your PPSSPP memstick folder).
3. Your five ACs are extracted, hashed, and pushed to your pilot profile automatically.

### 3 — Climb the Ladder

Find a target on the leaderboard and issue a **ranked challenge**. Your opponent has 24 hours to accept. On acceptance, the match queues immediately — both AC loadouts are loaded into a headless PPSSPP instance on the league server, the battle runs, and results post to the standings within minutes.

Anti-padding rules prevent rank farming. A 7-day cooldown applies per matchup. You can hold one active outgoing challenge at a time.

---

## The Game

*Armored Core: Formula Front — Extreme Battle* (ULUS-10034 / ULJS-19001 / ULES-00219) — PSP, 2005.

Unlike every other Armored Core title, Formula Front is **not a reflex game**. You build a team of five unmanned ACs, program each one's AI logic using a grid of operation cards and performance tuners, and enter them into 5v5 team battles. The AI fights autonomously. Your job is pure engineering.

This makes it uniquely suited to an asynchronous online league: there is no latency problem, no scheduling conflict, and no skill gap from connection quality. Two builds meet. One wins. The result is deterministic and replayable.

---

## League Links

| Resource | URL |
|---|---|
| League HQ (standings, challenges, profile) | [ffplhq.com/hq/](https://ffplhq.com/hq/) |
| Architect Nexus web client | [ffplhq.com/nexus/](https://ffplhq.com/nexus/) |
| Landing page | [ffplhq.com](https://ffplhq.com) |
| Releases | [github.com/AERProductions/ffpl/releases](https://github.com/AERProductions/ffpl/releases/latest) |
| Discord | [Formula Front Pro League Discord](https://discord.gg/YwFpyAq2KK) |

---

## Supported Regions

| Region | Game ID | Status |
|---|---|---|
| North America | ULUS-10034 | ✓ Supported |
| Japan | ULJS-19001 | ✓ Supported |
| Europe | ULES-00219 | ✓ Supported |

Save files from all supported regions are parsed correctly. AC names in Japanese (full-width Unicode) display as-is in the HQ portal.

---

## For Developers

This repo contains the full FFPL stack:

```
backend/          Go — save parser, Glicko-2, PPSSPP match runner, PocketBase client
ffpl-hq/          React/Vite — League HQ desktop UI (Wails frontend)
arch-nexus-web/   React/Vite — standalone web client
landing/          Static HTML — legacy landing reference (deployed site: AERProductions/ffplhq)
data/             AC part schema (ac_memory_schema.json)
```

### Build

Requires [Go 1.22+](https://go.dev) and [Wails v2](https://wails.io).

```bash
# Run tests
go test ./...

# Build the standalone automation server (no Wails, CGo-free)
go build -o ffpl-server .

# Cross-compile for Linux (e.g. from Windows to Edubuntu server)
CGO_ENABLED=0 GOOS=linux go build -o ffpl-server .

# Build the full desktop app (Wails) — requires -tags wails
wails build -tags wails
```

### Environment

Copy `deploy/server.env.template` to `server.env` and fill in:

```
FFPL_PB_HOST=https://pb.ffplhq.com
FFPL_API_KEY=<generate a strong random key>
FFPL_CORS_ORIGIN=https://ffplhq.com
```

The automation server runs on `:8091`. PocketBase runs on `:8090`. See `deploy/` for nginx and systemd configs.

---

## License

This project is an independent fan infrastructure tool. It does not distribute, modify, or reproduce any copyrighted game assets. Players must own a legitimate copy of *Armored Core: Formula Front — Extreme Battle* and run it on their own PPSSPP installation.

*Armored Core* is a trademark of FromSoftware, Inc. FFPL is not affiliated with or endorsed by FromSoftware or Bandai Namco Entertainment.

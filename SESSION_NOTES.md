# Laser Puzzle Game — Session Notes

This file captures the work done across recent Claude Code sessions so that
development can continue in a new session without losing context.

---

## Project Overview

A daily laser puzzle game. Players place mirrors on a 15×20 grid to redirect
a laser beam, aiming for the longest path. Stack: Next.js 16 (App Router),
React 19, TypeScript, Tailwind CSS 4, Prisma with PostgreSQL (Neon).

**Repo:** `idealisms/laser-puzzle-game`  
**Prod:** Vercel (auto-deploys from `main`)  
**Dev DB:** `.env.local` → Neon dev instance  
**Prod DB:** `.env.production` → Neon prod instance

---

## Puzzle Generation Pipeline

### Files involved
- `solver/puzzles/YYYY-MM-DD.json` — puzzle config (obstacle layout, laser, mirrors, optional splitters/gates)
- `solver/levels/YYYY-MM-DD.json` — solver output (obstacles flat list, optimalScore, optimalSolution)
- `prisma/seed.ts` — reads from `solver/levels/` and upserts `Level` rows

### Step-by-step
1. Write `solver/puzzles/YYYY-MM-DD.json` (see format below)
2. Run solver:
   - **No splitters:** `cd solver && npx tsx generate_levels.ts --start DATE --end DATE --workers 12 --v2 --beam-width 12000`
   - **Splitters:** `cd solver && npx tsx generate_levels.ts --start DATE --end DATE --workers 12 --beam-width 6000` (~9 min/puzzle, no `--v2`)
3. Seed to dev: `DOTENV_CONFIG_PATH=.env.local npm run db:seed`
4. Seed to prod: `DOTENV_CONFIG_PATH=.env.production npm run db:seed`

### Puzzle config format
```json
{
  "date": "2026-09-01",
  "name": "Dale",
  "width": 15,
  "height": 20,
  "laser": {"x": 0, "y": 9, "dir": "right"},
  "num_mirrors": 9,
  "obstacle_groups": [
    {"label": "NW corner", "cells": [[0,0],[1,0],[0,1]]}
  ],
  "splitters": [],
  "gates": []
}
```

### Grid conventions
- x: 0–14 (left→right), y: 0–19 (top→bottom)
- `"right"` laser → x=0 entry; `"left"` → x=14; `"down"` → y=0; `"up"` → y=19
- `"up"` means decreasing y (toward top of screen)
- **Never** place an obstacle at the laser's entry cell

### Design principles
- 8–11 mirrors per puzzle, no splitters for new puzzles
- Corner anchors (NW/NE/SW/SE) + edge wall pieces + interior obstacles
- **Run-breaker** on the laser's initial straight-line path (2 cells)
- Obstacle shapes: Z, L, S, T, pairs, squares — vary across puzzles
- Obstacles must reach near grid edges; avoid isolated central clusters
- Names: British landscape terms — track used names to avoid repeats

### Names used (do not reuse)
**Aug:** Clough, Tarn, Mere, Mire, Holt, Shaw, Covert, Croft, Haugh, Bourne,
Fleet, Carr, Links, Carse, Machair, Shingle, Strand, Rhos, Breck, Edge, Brow,
Knap, Brae, Knoll, Combe, Drum, Kyle, Hanger, Latch, Frith, Larig

**Sept 1–15:** Dale, Fell, Dene, Crag, Nook, Toft, Holm, Ghyll, Beck, Gill,
Linn, Garth, Strath, Ness, Force

**Sept 16–30:** Moor, Scar, Vale, Scree, Glen, Rigg, Cwm, Pike, Moss, Rake,
Hause, Knott, Wath, Wyke, Fen

### Gate semantics (for future use)
- `dir` = direction a laser must travel to **pass through** the gate
- All other directions are blocked
- Two-gate "turnstile": upper gate `dir="up"` + lower gate `dir="down"` on same column

### Splitter semantics
- `dir` = direction laser must travel to **trigger a split** (perpendicular beams)
- `laser dir == opposite(dir)` → wall (blocked)
- otherwise → reflects toward `OPPOSITE[dir]`
- **Always use non-v2 solver** (`--beam-width 6000`, no `--v2`) for splitter puzzles

---

## Mirror Format

Mirrors are stored in **compact format** `[[x, y, type], ...]` in both:
- `Level.optimalSolution` (DB column, seeded from solver output)
- `ScoreSubmission.mirrors` (player's submitted placement)

The helper `parseMirrorList()` in `src/lib/mirrorFormat.ts` handles both
compact `[number, number, string]` and legacy verbose `{x, y, type}` formats
(backwards-compatible read; all new writes use compact).

---

## Key Features Built

### Puzzle Rating UI (`/rate`) — PR #17, still open
- Dev-only (gated by `NEXT_PUBLIC_APP_MODE === 'DEV'`)
- `/rate` — lists all puzzles unrated-first, filter tabs, Export CSV button
- `/rate/[date]` — full playable game; tap "Optimal: N" to reveal solution; rate 1–7; "Next unrated →" appears after rating
- Ratings stored in `localStorage` under key `laser-puzzle-ratings`
- CSV export: `date, rating, optimalScore, ratedAt`
- **PR #17 is open and mergeable** — user hasn't merged it yet; no code changes needed

### Mirror Placement Storage — merged (PR #18, #19, #20)
- `ScoreSubmission` table has `mirrors TEXT?` column
- Stores player's mirror arrangement with each score submission
- Compact format `[[x,y,type],...]` since PR #20
- Migration: `prisma/migrations/20260809000000_add_mirrors_to_submission/migration.sql`
  - Uses `ADD COLUMN IF NOT EXISTS` (important — was briefly broken without `IF NOT EXISTS`)

---

## Bug Fixes Done This Session

### Splitter solution validation script
The following Python script checks all splitter puzzle solutions for correctness
(simulates laser and verifies all mirrors are reached and score matches):

```python
# Run from /home/user/laser-puzzle-game
python3 - << 'EOF'
import json, os
# ... (see session transcript for full script)
EOF
```

Two splitter puzzles had incorrect solutions (mirrors never reached, inflated scores):
- **Aug 14 (Carse):** was 131, corrected to 124 — fixed in PR #22, merged
- **Aug 29 (Latch):** was 126, corrected to 124 — fixed in PR #23, merged

Root cause: those puzzles were re-solved with `--v2` flag which doesn't handle
splitters. Always use the non-v2 command for splitter puzzles.

All other 37 splitter puzzles verified clean.

---

## Puzzles Delivered

| Month | Dates | PR | Status |
|-------|-------|----|--------|
| August | Aug 01–31 | #16 | Merged |
| September 1–15 | Sept 01–15 | #21 | Merged |
| September 16–30 | Sept 16–30 | TBD | In progress |

Sept 16–30 puzzle names and laser entries:
| Date | Name | Laser |
|------|------|-------|
| Date | Name | Laser | Mirrors | Score |
|------|------|-------|---------|-------|
| Sept 16 | Moor | down x=6 | 9 | 110 |
| Sept 17 | Scar | right y=4 | 10 | 118 |
| Sept 18 | Vale | up x=10 | 9 | 114 |
| Sept 19 | Scree | left y=9 | 10 | 114 |
| Sept 20 | Glen | down x=12 | 9 | 117 |
| Sept 21 | Rigg | right y=6 | 10 | 117 |
| Sept 22 | Cwm | up x=3 | 9 | 115 |
| Sept 23 | Pike | left y=11 | 10 | 116 |
| Sept 24 | Moss | down x=4 | 9 | 117 |
| Sept 25 | Rake | right y=15 | 10 | 124 |
| Sept 26 | Hause | up x=7 | 9 | 114 |
| Sept 27 | Knott | left y=6 | 10 | 113 |
| Sept 28 | Wath | down x=11 | 9 | 111 |
| Sept 29 | Wyke | right y=11 | 10 | 138 |
| Sept 30 | Fen | up x=5 | 9 | 108 |

---

## Pending Items

1. **PR #17 (puzzle rating UI)** — open, mergeable. User wants to rate puzzles
   to build a quality signal. Has rated ~37 puzzles so far; goal is 100+ before
   exporting for analysis. Merge when ready to test in staging.

2. **Sept 16–30 puzzles** — solver running, PR to be created after scores are in.

3. **Rating analysis** — once user has 100+ ratings, export CSV from `/rate` and
   analyze correlations between structural features (edge-hugging fraction,
   long-run count, obstacle diversity) and ratings to guide future puzzle design.

4. **Puzzle rating workflow** — user should use `/rate` on staging to play and
   rate puzzles (~30 sec each). At 100 ratings, export CSV, share with Claude for
   feature analysis.

---

## Branch Naming

Current working branch: `claude/create-september-puzzles`  
After a PR merges, restart the branch from main:
```bash
git fetch origin main && git checkout -B claude/create-september-puzzles origin/main
```

---

## DB Notes

- **Never echo the production database name or password** — use `****` in any logs
- Production DB is Neon PostgreSQL; has a web SQL console for direct queries
- Migration history tracked in `_prisma_migrations` table
- If a migration fails on Vercel (e.g., column already exists manually applied):
  ```sql
  UPDATE "_prisma_migrations"
  SET "rolled_back_at" = now()
  WHERE "migration_name" = '20260809000000_add_mirrors_to_submission';
  ```
  Then redeploy.

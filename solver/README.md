# Laser Puzzle Solver

A TypeScript/Node.js solver for the laser puzzle game that finds optimal mirror placements to maximize laser path length.

## Overview

The solver takes a puzzle configuration (grid size, laser position, obstacles, number of mirrors) and finds the mirror placement that maximizes the laser path length using parallel beam search.

The default search keeps one beam across all depths and splits each depth's expansion across `--workers` threads. The `--v2` search instead runs one worker per mirror-count depth.

## Files

| File | Description |
|------|-------------|
| `solve.ts` | **Main entry point** — CLI for solving puzzles; exports `solvePuzzle()` |
| `generate_levels.ts` | Generates `levels/YYYY-MM-DD.json` output files for seeding the game |
| `puzzles.ts` | Loads `puzzles/*.json`; flattens into solver config objects keyed by date |
| `puzzles/` | Source puzzle configs (one JSON per date) |
| `beam_search.ts` | Default search: layer-parallel beam search with deduplication of equivalent mirror sets |
| `beam_worker.ts` | Persistent worker thread that expands chunks of the beam for `beam_search.ts` |
| `fastsim.ts` | Allocation-free scorer used by the search; matches `calculateLaserPath` exactly |
| `simulator.ts` | `simulateLaser` adapter over `src/game/engine/simulate.ts`, used to verify solutions |
| `simulator2.ts` | Segment-based beam search with frontier pruning (`--v2` mode) |
| `worker.ts` | `--v2` worker thread: runs one `beamSearchForDepth2` call per mirror-count depth |
| `test_simulator.ts` | Unit tests for the `simulateLaser` adapter |
| `test_fastsim.ts` | Differential tests: `fastsim.ts` vs `calculateLaserPath` on every puzzle and on random collision-heavy boards |
| `test_beam_search.ts` | Beam search results verify and don't depend on worker count |
| `benchmark.js` | Benchmarks single-worker vs multi-worker performance |
| `levels/` | Generated level JSON files (one per date) |

## Setup

```bash
cd solver

# Requires Node.js with tsx installed
npm install -g tsx   # if not already installed
```

## Usage

All commands must be run from inside the `solver/` directory.

### Solve a puzzle

```bash
# Recommended (all puzzle types)
npx tsx solve.ts 2026-01-22 --beam-width 12000 --workers 12

# Other options
npx tsx solve.ts 2026-01-22 --quiet
npx tsx solve.ts --list
```

### Generate level files

```bash
# Recommended (all puzzle types)
npx tsx generate_levels.ts --date 2026-03-01 --beam-width 12000 --workers 12

# Date range
npx tsx generate_levels.ts --start 2026-03-01 --end 2026-03-07 --beam-width 12000 --workers 12
```

Generated files are saved to `levels/` and include the puzzle config, optimal score, and optimal solution.

### Run tests

```bash
node --require tsx/cjs --test test_simulator.ts test_fastsim.ts test_beam_search.ts
```

## CLI options

### `solve.ts`

| Option | Description | Default |
|--------|-------------|---------|
| `--workers N` | Number of parallel worker threads | CPU count |
| `--beam-width N` | Beam width for beam search | 12000 |
| `--no-prune` | Disable path-based pruning | Off |
| `--quiet` / `-q` | Hide detailed progress | Off |
| `--list` / `-l` | List all available puzzles | — |
| `--v2` | Use the older segment-based solver (simulator2) | Off |

### `generate_levels.ts`

| Option | Description | Default |
|--------|-------------|---------|
| `--date DATE` | Generate a single date | — |
| `--start DATE` | Start of date range | — |
| `--end DATE` | End of date range | — |
| `--workers N` | Number of parallel worker threads | CPU count |
| `--beam-width N` | Beam width for beam search | 12000 |
| `--v2` | Use the older segment-based solver (simulator2) | Off |

## Recommended settings

All puzzle types (plain, gates, splitters): `--beam-width 12000 --workers 12`, about 2–6 s per puzzle.

At that setting the default search matches or beats every shipped optimal score (checked on all 282 levels, Oct 2026). `--v2` is still available but is slower and doesn't model splitter collisions.

## Output

```
Puzzle: Zigzag Valley
Grid: 15x20
Mirrors available: 9
Obstacles: 38
Laser: (0, 19) -> up

Solving with beam search (beam_width: 12000, workers: 12)...

==================================================
SOLUTION
==================================================
Path length: 87
Mirrors placed: 9
  (1, 18) -> /
  (3, 16) -> \
  ...
Solve time: 3.90s
```

## Puzzle config format (`puzzles/YYYY-MM-DD.json`)

```json
{
  "date": "2026-03-01",
  "name": "Example Puzzle",
  "width": 15,
  "height": 20,
  "laser": { "x": 0, "y": 19, "dir": "up" },
  "num_mirrors": 9,
  "obstacle_groups": [
    { "label": "left wall", "cells": [[0, 5], [0, 6]] }
  ],
  "splitters": [
    { "x": 7, "y": 10, "dir": "right" }
  ],
  "gates": [
    { "x": 3, "y": 5, "dir": "up" }
  ]
}
```

- `splitters` and `gates` are optional.
- `dir` on a splitter = the direction a laser must travel **to trigger a split**. See CLAUDE.md for full splitter semantics.
- `dir` on a gate = the single direction a laser can **pass through**. All other directions are blocked.

## Generated level format (`levels/YYYY-MM-DD.json`)

```json
{
  "date": "2026-03-01",
  "gridWidth": 15,
  "gridHeight": 20,
  "laserConfig": { "x": 0, "y": 19, "direction": "up" },
  "obstacles": [
    { "x": 0, "y": 5 },
    { "x": 7, "y": 10, "type": "splitter", "orientation": "right" },
    { "x": 3, "y": 5, "type": "gate", "orientation": "up" }
  ],
  "mirrorsAvailable": 9,
  "optimalScore": 87,
  "optimalSolution": [
    { "x": 1, "y": 18, "type": "/" },
    { "x": 3, "y": 16, "type": "\\" }
  ]
}
```

## How it works

1. **Puzzle loading**: `puzzles.ts` reads `puzzles/*.json` and flattens each config into a solver-friendly format (flat obstacle arrays, integer direction constants).
2. **Beam search** (`beam_search.ts`): the main thread holds the beam. At each depth it hands chunks of the beam to persistent worker threads, which try both mirror types on every cell the current beams pass through and keep a local top-`beam_width`. The main thread merges the workers' lists into the next beam and tracks the best placement seen at any depth.
3. **Scoring** (`fastsim.ts`): each candidate is scored with an integer-grid simulator that reproduces `calculateLaserPath` exactly (splitters, gates, loops, collisions) without allocating. `test_fastsim.ts` keeps the two in sync.
4. **Compact, deduplicated beam**: a beam entry is just its mirror list (one Uint16 per mirror). Mirror sets reached in different orders are deduplicated by a Zobrist hash, and ties are broken by that hash, so results are deterministic and independent of the worker count.
5. **Verification**: the solution is re-simulated with `calculateLaserPath` to confirm the reported score.

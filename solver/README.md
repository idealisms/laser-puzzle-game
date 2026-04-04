# Laser Puzzle Solver

A TypeScript/Node.js solver for the laser puzzle game that finds optimal mirror placements to maximize laser path length.

## Overview

The solver takes a puzzle configuration (grid size, laser position, obstacles, number of mirrors) and finds the mirror placement that maximizes the laser path length using parallel beam search.

Workers are parallelized across mirror-count depth levels: one worker per depth (1 through `num_mirrors`), capped to `--workers` concurrent threads.

## Files

| File | Description |
|------|-------------|
| `solve.ts` | **Main entry point** — CLI for solving puzzles; exports `solvePuzzle()` |
| `generate_levels.ts` | Generates `levels/YYYY-MM-DD.json` output files for seeding the game |
| `puzzles.ts` | Loads `puzzles/*.json`; flattens into solver config objects keyed by date |
| `puzzles/` | Source puzzle configs (one JSON per date) |
| `simulator.ts` | Adapter over `src/game/engine/simulate.ts`; contains beam search and incremental solver |
| `simulator2.ts` | Segment-based beam search with frontier pruning (experimental `--v2` mode) |
| `worker.ts` | Worker thread: runs one `beamSearchForDepth` call per mirror-count depth |
| `test_simulator.ts` | 19 unit tests for the simulator |
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
npx tsx solve.ts 2026-01-22

# With options
npx tsx solve.ts 2026-01-22 --workers 12 --beam-width 6000
npx tsx solve.ts 2026-01-22 --quiet
npx tsx solve.ts 2026-01-22 --v2          # segment-based solver (experimental)

# List all available puzzles
npx tsx solve.ts --list
```

### Generate level files

```bash
# Single date
npx tsx generate_levels.ts --date 2026-03-01

# Date range
npx tsx generate_levels.ts --start 2026-03-01 --end 2026-03-07

# With tuning options
npx tsx generate_levels.ts --start 2026-03-01 --end 2026-03-07 --workers 12 --beam-width 6000
```

Generated files are saved to `levels/` and include the puzzle config, optimal score, and optimal solution.

### Run tests

```bash
node --require tsx/cjs --test test_simulator.ts
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
| `--v2` | Use segment-based solver (simulator2) | Off |

### `generate_levels.ts`

| Option | Description | Default |
|--------|-------------|---------|
| `--date DATE` | Generate a single date | — |
| `--start DATE` | Start of date range | — |
| `--end DATE` | End of date range | — |
| `--workers N` | Number of parallel worker threads | CPU count |
| `--beam-width N` | Beam width for beam search | 12000 |

## Recommended settings

| Puzzle type | Recommended command |
|-------------|---------------------|
| No splitters/gates | `--workers 12` (defaults are fine) |
| Splitters or gates | `--workers 12 --beam-width 6000` (~9 min/puzzle) |

Splitter and gate puzzles use full simulation at each beam search step (no incremental optimization), so they are significantly slower.

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
2. **Initial simulation**: The laser is simulated with no mirrors placed to establish a baseline path and valid candidate positions.
3. **Parallel beam search**: `solve.ts` spawns one worker per mirror-count depth (1 through `num_mirrors`). Each worker runs `beamSearchForDepth`, keeping the top `beam_width` states at each step.
4. **Incremental optimization**: For puzzles without splitters or gates, the solver uses incremental path extension — only re-simulating the new segment after each mirror placement rather than re-running the full simulation.
5. **Best result**: The main thread collects results from all workers and returns the highest-scoring placement.
6. **Verification**: The solution is re-simulated to confirm the reported score.

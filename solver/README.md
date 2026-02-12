# Laser Puzzle Solver

A Python-based solver for the laser puzzle game that finds optimal mirror placements to maximize laser path length.

## Overview

The solver takes a puzzle configuration (grid size, laser position, obstacles, number of mirrors) and finds the mirror placement that maximizes the laser path length using beam search.

For best performance, run with **PyPy** for 5-10x faster execution:

```bash
pypy3 solve.py 2026-01-22
```

## Files

| File | Description |
|------|-------------|
| `solve.py` | **Main entry point** - CLI for solving puzzles |
| `puzzles.py` | Puzzle configurations keyed by date (15x20 grids, 8-11 mirrors) |
| `simulator.py` | Laser path simulator and beam search solver implementation |
| `generate_levels.py` | Generates level JSON files with optimal scores for the game |
| `levels/` | Generated level JSON files (one per date) |

## Setup

```bash
cd solver

# No external dependencies required - uses only the Python standard library
# For best performance, install PyPy: https://www.pypy.org/
```

## Usage

### Basic usage

```bash
# Solve a puzzle by date
pypy3 solve.py 2026-01-22

# List all available puzzles
python solve.py --list

# Solve with quiet output
python solve.py 2026-01-22 -q
```

### Tuning beam search

```bash
# Wider beam for potentially better solutions (slower)
python solve.py 2026-01-22 --beam-width 3000

# Disable path pruning (slower but more thorough)
python solve.py 2026-01-22 --no-prune
```

### Generating levels

```bash
# Generate a level JSON for a specific date
pypy3 generate_levels.py --date 2026-03-01

# Generate a range of dates
pypy3 generate_levels.py --start 2026-03-01 --end 2026-03-07
```

Generated files are saved to `levels/` and include the puzzle configuration and optimal score.

### All CLI options

```bash
python solve.py --help
```

| Option | Description | Default |
|--------|-------------|---------|
| `-q, --quiet` | Hide detailed progress | Off |
| `--beam-width` | Beam width for beam search | 2000 |
| `--no-prune` | Disable path-based pruning | Off |
| `-l, --list` | List all available puzzles | - |

## Output

The solver outputs:
- **Path length**: Number of cells the laser traverses before exiting the grid or hitting an obstacle
- **Mirrors**: List of mirror placements as `(x, y, type)` tuples where type is `/` or `\`
- **Solve time**: Time taken to find the solution

Example output:
```
Puzzle: Zigzag Valley
Grid: 15x20
Mirrors available: 9
Obstacles: 38
Laser: (0, 19) -> UP

Solving with beam search (beam_width: 2000)...

==================================================
SOLUTION
==================================================
Path length: 87
Mirrors placed: 9
  (1, 18) -> /
  (3, 16) -> \
  ...
Solve time: 12.34s
```

## How It Works

The beam search solver:
1. Incrementally builds mirror placements, keeping the top `beam_width` candidates at each step
2. Uses path-based pruning to eliminate redundant states
3. Fast and effective for all puzzle sizes

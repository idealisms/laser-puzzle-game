# Laser Puzzle Solver

A Python-based solver for the laser puzzle game that finds optimal mirror placements to maximize laser path length.

## Overview

The solver takes a puzzle configuration (grid size, laser position, obstacles, number of mirrors) and finds the mirror placement that maximizes the laser path length. It includes two solving algorithms:

- **Beam search** (default) - Fast heuristic search that works well on all puzzle sizes
- **CP-SAT** - Google OR-Tools constraint solver that can prove optimality but is slower

Beam search is the default because it is significantly faster and often finds equal or better solutions, especially on larger puzzles.

## Files

| File | Description |
|------|-------------|
| `solve.py` | **Main entry point** - unified CLI for solving puzzles |
| `puzzles.py` | Defines the 7 puzzle configurations from the game (10x10 grids) |
| `large_puzzles.py` | Larger puzzle configurations (15x20 grids with 10 mirrors) for scalability testing |
| `simulator.py` | Laser path simulator and beam search solver implementation |
| `cpsat_solver.py` | CP-SAT constraint solver using Google OR-Tools |
| `test_solver.py` | Test harness that compares both solvers on all 10x10 puzzles |
| `test_large_puzzles.py` | Test harness for 15x20 puzzles with extended time limits |
| `requirements.txt` | Python dependencies (ortools>=9.8) |

## Setup

```bash
cd solver

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Basic usage

```bash
# Solve a puzzle with beam search (default)
python solve.py 0

# List all available puzzles
python solve.py --list

# Solve with verbose output
python solve.py 4 -v
```

### Using CP-SAT solver

Use the `--cpsat` flag to use the OR-Tools constraint solver instead of beam search:

```bash
# Solve with CP-SAT
python solve.py 4 --cpsat

# CP-SAT with custom time limit
python solve.py 4 --cpsat --time-limit 120

# CP-SAT with extended max time steps
python solve.py 4 --cpsat --max-time 100 --time-limit 180
```

### Large puzzles

```bash
# Solve a large puzzle (15x20 grid)
python solve.py large-0

# Large puzzle with wider beam
python solve.py large-0 --beam-width 1000 --random-iterations 20000
```

### All options

```bash
python solve.py --help
```

| Option | Description | Default |
|--------|-------------|---------|
| `--cpsat` | Use CP-SAT solver instead of beam search | Off (beam search) |
| `-v, --verbose` | Show detailed progress | Off |
| `--beam-width` | Beam width for beam search | 500 |
| `--random-iterations` | Random search iterations | 10000 |
| `--time-limit` | CP-SAT time limit (seconds) | 60 |
| `--max-time` | CP-SAT max simulation steps | 80 |

### Running tests

```bash
# Compare both solvers on all standard puzzles
python test_solver.py

# Quick test on single puzzle
python test_solver.py --quick

# Custom time limit
python test_solver.py 120
```

## Output

The solver outputs:
- **Path length**: Number of cells the laser traverses before exiting the grid or hitting an obstacle
- **Mirrors**: List of mirror placements as `(x, y, type)` tuples where type is `/` or `\`
- **Solve time**: Time taken to find the solution

Example output:
```
Puzzle: Cross Pattern
Grid: 10x10
Mirrors available: 5
Obstacles: 16
Laser: (0, 9) -> UP

Solving with beam search (beam_width: 500, random_iterations: 10000)...

==================================================
SOLUTION
==================================================
Path length: 42
Mirrors placed: 5
  (1, 8) -> /
  (3, 6) -> \
  (7, 2) -> /
  (9, 4) -> \
  (4, 0) -> /
Solve time: 2.34s
```

## How It Works

### Beam Search (Default)

The beam search solver:
1. Incrementally builds mirror placements, keeping the top `beam_width` candidates at each step
2. Supplements with random search to escape local optima
3. Fast and effective for all puzzle sizes

### CP-SAT Solver

The constraint solver models the problem symbolically:
1. **Decision variables**: For each valid cell, whether a mirror is placed and its type
2. **Path variables**: Position and direction at each time step (up to `max_time`)
3. **Constraints**: Laser physics (movement, boundary checking, reflection rules)
4. **Objective**: Maximize path length (sum of alive time steps)

The solver uses:
- Element constraints for direction-dependent movement
- Reified constraints for conditional logic (boundaries, obstacles, reflections)
- Boolean multiplication for conjunctions
- 8 parallel workers for faster solving

## Puzzles

### Standard Puzzles (10x10)

The 7 puzzle configurations from the game:

| # | Name | Grid | Mirrors | Obstacles |
|---|------|------|---------|-----------|
| 0 | Corridor Run | 10x10 | 5 | 15 |
| 1 | Zigzag Barriers | 10x10 | 6 | 13 |
| 2 | Central Fortress | 10x10 | 5 | 14 |
| 3 | Scattered Maze | 10x10 | 6 | 16 |
| 4 | Cross Pattern | 10x10 | 5 | 16 |
| 5 | Spiral Walls | 10x10 | 6 | 20 |
| 6 | Chamber Maze | 10x10 | 7 | 22 |

### Large Puzzles (15x20)

Additional puzzles for scalability testing:

| # | Name | Grid | Mirrors | Obstacles |
|---|------|------|---------|-----------|
| large-0 | Spiral Inward | 15x20 | 10 | 84 |
| large-1 | Chamber Grid | 15x20 | 10 | 51 |
| large-2 | Diagonal Barriers | 15x20 | 10 | 35 |
| large-3 | Fortress | 15x20 | 10 | 55 |
| large-4 | Labyrinth | 15x20 | 10 | 55 |
| large-5 | Scattered Islands | 15x20 | 10 | 45 |

## Performance Comparison

### Why Beam Search is Default

Beam search is the default solver because:
1. **Faster**: Completes in seconds vs minutes/hours for CP-SAT
2. **Better on large puzzles**: CP-SAT often times out before finding good solutions
3. **Good solutions**: Usually finds optimal or near-optimal solutions

### When to Use CP-SAT

Use `--cpsat` when you need:
- **Proven optimality**: CP-SAT can prove a solution is optimal (status: `OPTIMAL`)
- **Small puzzles**: Works well on 10x10 grids with 5-7 mirrors
- **Verification**: Confirm beam search found the true optimum

### Benchmark Results

Test results on the Spiral Inward large puzzle (15x20, 10 mirrors):
- **Beam search**: 139 path length in ~3 minutes
- **CP-SAT**: 125 path length (FEASIBLE) in 602s (timed out)

### Recommendations by Grid Size

| Grid Size | Mirrors | Recommended Approach |
|-----------|---------|---------------------|
| 10x10 | 5-7 | Beam search (fast), or CP-SAT if optimality proof needed |
| 15x15 | 8-10 | Beam search recommended |
| 15x20+ | 10+ | Beam search (CP-SAT will likely timeout) |

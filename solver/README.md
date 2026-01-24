# Laser Puzzle Solver

A Python-based solver for the laser puzzle game that finds optimal mirror placements to maximize laser path length. Uses Google OR-Tools CP-SAT constraint solver to find provably optimal solutions.

## Overview

The solver takes a puzzle configuration (grid size, laser position, obstacles, number of mirrors) and finds the mirror placement that maximizes the laser path length. It includes both a constraint programming solver (CP-SAT) and a beam search baseline for comparison.

## Files

| File | Description |
|------|-------------|
| `puzzles.py` | Defines the 7 puzzle configurations from the game (10x10 grids) |
| `large_puzzles.py` | Larger puzzle configurations (15x20 grids with 10 mirrors) for scalability testing |
| `simulator.py` | Laser path simulator that traces the beam through the grid. Also includes a beam search solver used as a baseline |
| `cpsat_solver.py` | Main solver using Google OR-Tools CP-SAT constraint programming. Models laser physics symbolically to find optimal solutions |
| `test_solver.py` | Test harness that runs both solvers on all 10x10 puzzles and compares results |
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

### Run the CP-SAT solver on a single puzzle

```bash
python cpsat_solver.py
```

This runs the solver on the "Cross Pattern" puzzle (puzzle #4) and prints the optimal solution.

### Test all puzzles with comparison

```bash
# Full test (60s time limit per puzzle)
python test_solver.py

# Custom time limit (in seconds)
python test_solver.py 120

# Quick test on single puzzle
python test_solver.py --quick
```

### Run beam search baseline only

```bash
python simulator.py
```

## Output

The solver outputs:
- **Path length**: Number of cells the laser traverses before exiting the grid or hitting an obstacle
- **Mirrors**: List of mirror placements as `(x, y, type)` tuples where type is `/` or `\`
- **Status**: `OPTIMAL` (proven best) or `FEASIBLE` (good solution, may not be optimal)
- **Solve time**: Time taken to find the solution

Example output:
```
Solving 'Cross Pattern' (10x10 grid, 5 mirrors)...
Laser: (0, 9) -> UP
Obstacles: 16, Valid cells: 83

OPTIMAL solution found!
Path length: 42
Mirrors placed: 5
  (1, 8) -> /
  (3, 6) -> \
  (7, 2) -> /
  (9, 4) -> \
  (4, 0) -> /
Solve time: 23.45s
```

## How It Works

### Simulator (`simulator.py`)

The simulator traces the laser path step by step:
1. Start at the laser source with the initial direction
2. Move one cell in the current direction
3. If out of bounds or hitting an obstacle, terminate
4. If hitting a mirror, reflect (change direction based on mirror type)
5. Repeat until termination or loop detected

### CP-SAT Solver (`cpsat_solver.py`)

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

### Beam Search Baseline (`simulator.py`)

A heuristic solver that:
1. Incrementally builds mirror placements, keeping the top `beam_width` candidates
2. Supplements with random search to escape local optima
3. Used to verify CP-SAT results and as a fast approximation

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
| 0 | Spiral Inward | 15x20 | 10 | 84 |
| 1 | Chamber Grid | 15x20 | 10 | 51 |
| 2 | Diagonal Barriers | 15x20 | 10 | 35 |
| 3 | Fortress | 15x20 | 10 | 55 |
| 4 | Labyrinth | 15x20 | 10 | 55 |
| 5 | Scattered Islands | 15x20 | 10 | 45 |

## Performance Notes

- Solving time depends heavily on puzzle complexity and `max_time` parameter
- `max_time` should be set to at least the expected optimal path length
- Typical solve times range from seconds to minutes per puzzle
- The solver is parallelized across 8 CPU workers by default

## Scalability

### 10x10 Grids (Standard Puzzles)

The CP-SAT solver performs well on 10x10 grids with 5-7 mirrors:
- Typical solve time: seconds to minutes
- Often proves `OPTIMAL` within time limits
- Outperforms or matches beam search

### 15x20 Grids (Large Puzzles)

Larger puzzles (15x20 with 10 mirrors) are significantly more challenging:

| Factor | 10x10, 6 mirrors | 15x20, 10 mirrors |
|--------|------------------|-------------------|
| Valid cells | ~85 | ~220 |
| Constraints per step | ~85 | ~220 |
| Mirror combinations | ~10⁹ | ~10²¹ |

**Test Results** (Spiral Inward puzzle, max_time=300, time_limit=600s):
- Beam search: **139** path length in ~3 minutes
- CP-SAT: **125** (FEASIBLE) in 602s (timed out)

For large puzzles, beam search often outperforms CP-SAT because:
1. CP-SAT times out before proving optimality
2. The constraint model grows quadratically with grid size
3. Beam search heuristics can find good solutions quickly

### Recommendations by Grid Size

| Grid Size | Mirrors | Recommended Approach |
|-----------|---------|---------------------|
| 10x10 | 5-7 | CP-SAT (optimal solutions likely) |
| 15x15 | 8-10 | Both (compare results) |
| 15x20+ | 10+ | Beam search (faster, often better) |

### Testing Large Puzzles

```bash
# Test a single large puzzle
python test_large_puzzles.py --single 0

# Test all large puzzles (may take hours)
python test_large_puzzles.py

# Custom time limits
python test_large_puzzles.py 600 300  # time_limit=600s, max_time=300
```

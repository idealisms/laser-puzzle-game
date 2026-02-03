#!/usr/bin/env python3
"""
Laser Puzzle Solver - Unified CLI

Solves laser puzzles using beam search (default) or CP-SAT constraint solver.
Beam search is faster and often finds better solutions for larger puzzles.

Performance tip: Run with PyPy for 5-10x faster execution:
    pypy3 solve.py 2026-01-22 --verbose
"""

import argparse
import sys
import time
from puzzles import PUZZLES, PuzzleConfig
from large_puzzles import LARGE_PUZZLES
from simulator import beam_search_solver, simulate_laser


def solve_with_beam_search(
    config: PuzzleConfig,
    beam_width: int,
    random_iterations: int,
    verbose: bool,
    use_pruning: bool = True,
) -> dict:
    """Solve using beam search."""
    start_time = time.time()
    result = beam_search_solver(
        config,
        beam_width=beam_width,
        random_iterations=random_iterations,
        verbose=verbose,
        use_path_pruning=use_pruning,
    )
    elapsed = time.time() - start_time
    return {
        'path_length': result['path_length'],
        'mirrors': result['mirrors'],
        'solve_time': elapsed,
        'solver': 'beam_search',
    }


def solve_with_cpsat(config: PuzzleConfig, max_time: int, time_limit: int, verbose: bool) -> dict | None:
    """Solve using CP-SAT constraint solver."""
    from cpsat_solver import solve_puzzle
    result = solve_puzzle(config, max_time=max_time, time_limit=time_limit, verbose=verbose)
    if result:
        result['solver'] = 'cpsat'
    return result


def list_puzzles():
    """Print available puzzles."""
    print("Puzzles by date (15x20):")
    print("-" * 60)
    for date, config in PUZZLES.items():
        print(f"  {date}: {config.name} ({config.num_mirrors} mirrors)")

    print("\nLarge puzzles (15x20):")
    print("-" * 60)
    for i, config in enumerate(LARGE_PUZZLES):
        print(f"  large-{i}: {config.name} ({config.num_mirrors} mirrors)")


def get_puzzle(puzzle_id: str) -> PuzzleConfig:
    """Get puzzle by ID (date YYYY-MM-DD or 'large-N')."""
    if puzzle_id.startswith('large-'):
        idx = int(puzzle_id[6:])
        if idx < 0 or idx >= len(LARGE_PUZZLES):
            raise ValueError(f"Invalid large puzzle index: {idx}. Valid range: 0-{len(LARGE_PUZZLES)-1}")
        return LARGE_PUZZLES[idx]
    elif puzzle_id in PUZZLES:
        return PUZZLES[puzzle_id]
    else:
        # Try to interpret as index into PUZZLES dict for backwards compat
        try:
            idx = int(puzzle_id)
            dates = list(PUZZLES.keys())
            if 0 <= idx < len(dates):
                return PUZZLES[dates[idx]]
        except ValueError:
            pass
        raise ValueError(f"Invalid puzzle ID: {puzzle_id}. Use date (YYYY-MM-DD) or 'large-N'")


def main():
    parser = argparse.ArgumentParser(
        description='Solve laser puzzles to find optimal mirror placements.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  pypy3 solve.py 2026-01-22            # Solve puzzle by date (recommended with PyPy)
  python solve.py 2026-01-22 --cpsat   # Use CP-SAT solver instead
  python solve.py large-0              # Solve large puzzle 0
  python solve.py --list               # List all available puzzles
  python solve.py 2026-01-22 --beam-width 1000  # Wider beam for better solutions
  python solve.py 2026-01-22 --no-prune         # Disable path pruning (slower)
"""
    )

    parser.add_argument('puzzle', nargs='?', default=None,
                        help='Puzzle ID: date (YYYY-MM-DD) or large-N for test puzzles')
    parser.add_argument('--list', '-l', action='store_true',
                        help='List all available puzzles')
    parser.add_argument('--cpsat', action='store_true',
                        help='Use CP-SAT constraint solver instead of beam search')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show detailed progress')

    # Beam search options
    beam_group = parser.add_argument_group('Beam search options')
    beam_group.add_argument('--beam-width', type=int, default=500,
                            help='Beam width for beam search (default: 500)')
    beam_group.add_argument('--random-iterations', type=int, default=10000,
                            help='Random search iterations (default: 10000)')
    beam_group.add_argument('--no-prune', action='store_true',
                            help='Disable path-based pruning (slower but more thorough)')

    # CP-SAT options
    cpsat_group = parser.add_argument_group('CP-SAT options')
    cpsat_group.add_argument('--time-limit', type=int, default=60,
                             help='CP-SAT solver time limit in seconds (default: 60)')
    cpsat_group.add_argument('--max-time', type=int, default=80,
                             help='Maximum time steps to simulate (default: 80)')

    args = parser.parse_args()

    if args.list:
        list_puzzles()
        return 0

    if args.puzzle is None:
        parser.print_help()
        return 1

    # Get puzzle
    try:
        config = get_puzzle(args.puzzle)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    # Print puzzle info
    print(f"Puzzle: {config.name}")
    print(f"Grid: {config.width}x{config.height}")
    print(f"Mirrors available: {config.num_mirrors}")
    print(f"Obstacles: {len(config.obstacles)}")
    print(f"Laser: ({config.laser_x}, {config.laser_y}) -> {config.laser_dir.name}")
    print()

    # Solve
    if args.cpsat:
        print(f"Solving with CP-SAT (time limit: {args.time_limit}s, max_time: {args.max_time})...")
        result = solve_with_cpsat(config, args.max_time, args.time_limit, args.verbose)
        if result is None:
            print("No solution found!")
            return 1
    else:
        prune_str = ", no-prune" if args.no_prune else ""
        print(f"Solving with beam search (beam_width: {args.beam_width}, random_iterations: {args.random_iterations}{prune_str})...")
        result = solve_with_beam_search(
            config,
            args.beam_width,
            args.random_iterations,
            args.verbose,
            use_pruning=not args.no_prune,
        )

    # Print results
    print()
    print("=" * 50)
    print("SOLUTION")
    print("=" * 50)
    print(f"Path length: {result['path_length']}")
    print(f"Mirrors placed: {len(result['mirrors'])}")
    for x, y, t in result['mirrors']:
        print(f"  ({x}, {y}) -> {t}")
    print(f"Solve time: {result['solve_time']:.2f}s")

    # Verify solution
    verified = simulate_laser(config, result['mirrors'])
    if verified['length'] != result['path_length']:
        print(f"WARNING: Verification failed! Expected {result['path_length']}, got {verified['length']}")
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""
Laser Puzzle Solver - CLI

Solves laser puzzles using beam search to find optimal mirror placements.

Performance tip: Run with PyPy for 5-10x faster execution:
    pypy3 solve.py 2026-01-22
"""

import argparse
import sys
import time
from puzzles import PUZZLES, PuzzleConfig
from simulator import beam_search_solver, simulate_laser


def solve_with_beam_search(
    config: PuzzleConfig,
    beam_width: int,
    verbose: bool,
    use_pruning: bool = True,
) -> dict:
    """Solve using beam search."""
    start_time = time.time()
    result = beam_search_solver(
        config,
        beam_width=beam_width,
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


def list_puzzles():
    """Print available puzzles."""
    print("Puzzles by date (15x20):")
    print("-" * 60)
    for date, config in PUZZLES.items():
        print(f"  {date}: {config.name} ({config.num_mirrors} mirrors)")


def get_puzzle(puzzle_id: str) -> PuzzleConfig:
    """Get puzzle by date (YYYY-MM-DD)."""
    if puzzle_id in PUZZLES:
        return PUZZLES[puzzle_id]
    raise ValueError(f"Invalid puzzle ID: {puzzle_id}. Use date (YYYY-MM-DD)")


def main():
    parser = argparse.ArgumentParser(
        description='Solve laser puzzles to find optimal mirror placements.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  pypy3 solve.py 2026-01-22            # Solve puzzle by date (recommended with PyPy)
  python solve.py --list               # List all available puzzles
  python solve.py 2026-01-22 --beam-width 3000  # Wider beam for better solutions
  python solve.py 2026-01-22 --no-prune         # Disable path pruning (slower)
"""
    )

    parser.add_argument('puzzle', nargs='?', default=None,
                        help='Puzzle date (YYYY-MM-DD)')
    parser.add_argument('--list', '-l', action='store_true',
                        help='List all available puzzles')
    parser.add_argument('--quiet', '-q', action='store_true',
                        help='Hide detailed progress')

    # Beam search options
    beam_group = parser.add_argument_group('Beam search options')
    beam_group.add_argument('--beam-width', type=int, default=2000,
                            help='Beam width for beam search (default: 2000)')
    beam_group.add_argument('--no-prune', action='store_true',
                            help='Disable path-based pruning (slower but more thorough)')

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
    prune_str = ", no-prune" if args.no_prune else ""
    print(f"Solving with beam search (beam_width: {args.beam_width}{prune_str})...")
    result = solve_with_beam_search(
        config,
        args.beam_width,
        not args.quiet,
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

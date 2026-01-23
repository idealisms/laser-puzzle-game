#!/usr/bin/env python3
"""
Test the CP-SAT solver against all puzzles and compare with beam search baseline.
"""

import sys
from puzzles import PUZZLES
from simulator import beam_search_solver, simulate_laser, verify_solution
from cpsat_solver import solve_puzzle


def test_all_puzzles(time_limit: int = 60, max_time: int = 80):
    """Test CP-SAT solver on all puzzles and compare with beam search."""

    print("=" * 70)
    print("LASER PUZZLE SOLVER TEST")
    print("=" * 70)
    print()

    results = []

    for i, config in enumerate(PUZZLES):
        print(f"\n{'=' * 70}")
        print(f"PUZZLE {i}: {config.name}")
        print(f"{'=' * 70}")

        # First, get baseline from beam search
        print("\n[1] Running beam search baseline...")
        baseline = beam_search_solver(config, beam_width=500, random_iterations=10000)
        baseline_score = baseline['path_length']
        print(f"    Baseline score: {baseline_score}")

        # Run CP-SAT solver
        print(f"\n[2] Running CP-SAT solver (time limit: {time_limit}s)...")
        cpsat_result = solve_puzzle(config, max_time=max_time, time_limit=time_limit, verbose=False)

        if cpsat_result is None:
            print("    CP-SAT: No solution found!")
            cpsat_score = 0
            cpsat_status = "NO_SOLUTION"
        else:
            cpsat_score = cpsat_result['path_length']
            cpsat_status = cpsat_result['status']
            print(f"    CP-SAT score: {cpsat_score} ({cpsat_status})")
            print(f"    Solve time: {cpsat_result['solve_time']:.2f}s")

            # Verify the solution
            if cpsat_result['mirrors']:
                verified = verify_solution(config, cpsat_result['mirrors'], cpsat_score)
                print(f"    Solution verified: {verified}")
                if not verified:
                    actual = simulate_laser(config, cpsat_result['mirrors'])
                    print(f"    Actual length: {actual['length']} (expected {cpsat_score})")

        # Compare results
        print(f"\n[3] Comparison:")
        print(f"    Baseline (beam search): {baseline_score}")
        print(f"    CP-SAT solver:          {cpsat_score}")

        if cpsat_score > baseline_score:
            print(f"    >> CP-SAT found BETTER solution! (+{cpsat_score - baseline_score})")
            comparison = "BETTER"
        elif cpsat_score == baseline_score:
            print(f"    >> Solutions MATCH")
            comparison = "MATCH"
        else:
            print(f"    >> CP-SAT found WORSE solution (-{baseline_score - cpsat_score})")
            comparison = "WORSE"

        results.append({
            'name': config.name,
            'baseline': baseline_score,
            'cpsat': cpsat_score,
            'cpsat_status': cpsat_status if cpsat_result else "NO_SOLUTION",
            'comparison': comparison,
            'solve_time': cpsat_result['solve_time'] if cpsat_result else None,
        })

    # Summary
    print("\n")
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print()
    print(f"{'Puzzle':<20} {'Baseline':>10} {'CP-SAT':>10} {'Status':>12} {'Time':>8} {'Result':>10}")
    print("-" * 70)

    for r in results:
        time_str = f"{r['solve_time']:.1f}s" if r['solve_time'] else "N/A"
        print(f"{r['name']:<20} {r['baseline']:>10} {r['cpsat']:>10} {r['cpsat_status']:>12} {time_str:>8} {r['comparison']:>10}")

    # Overall stats
    matches = sum(1 for r in results if r['comparison'] == 'MATCH')
    better = sum(1 for r in results if r['comparison'] == 'BETTER')
    worse = sum(1 for r in results if r['comparison'] == 'WORSE')

    print("-" * 70)
    print(f"Total: {len(results)} puzzles | Match: {matches} | Better: {better} | Worse: {worse}")

    return results


def quick_test():
    """Quick test with just one puzzle."""
    print("Quick test with Cross Pattern puzzle...\n")

    config = PUZZLES[4]  # Cross Pattern

    print(f"Puzzle: {config.name}")
    print(f"Grid: {config.width}x{config.height}")
    print(f"Mirrors available: {config.num_mirrors}")
    print(f"Obstacles: {len(config.obstacles)}")
    print()

    # Baseline
    print("Running beam search...")
    baseline = beam_search_solver(config, verbose=True)
    print(f"Baseline: {baseline['path_length']}")
    print(f"Mirrors: {baseline['mirrors']}")
    print()

    # CP-SAT
    print("Running CP-SAT solver...")
    result = solve_puzzle(config, max_time=40, time_limit=60, verbose=True)

    if result:
        print(f"\nCP-SAT result: {result['path_length']}")
        # Verify
        if result['mirrors']:
            actual = simulate_laser(config, result['mirrors'])
            print(f"Verified length: {actual['length']}")


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--quick':
        quick_test()
    else:
        # Full test with all puzzles
        time_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 60
        test_all_puzzles(time_limit=time_limit)

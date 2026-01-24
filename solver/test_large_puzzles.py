#!/usr/bin/env python3
"""
Test the CP-SAT solver on large 15x20 puzzles.
Compares with beam search baseline.
"""

import sys
import time
from large_puzzles import LARGE_PUZZLES
from simulator import beam_search_solver, simulate_laser, verify_solution
from cpsat_solver import solve_puzzle


def test_large_puzzles(
    max_time: int = 300,
    time_limit: int = 600,
    beam_width: int = 1000,
    random_iterations: int = 50000,
):
    """Test CP-SAT solver on large puzzles and compare with beam search."""

    print("=" * 80)
    print("LARGE PUZZLE SOLVER TEST (15x20 grids, 10 mirrors)")
    print(f"CP-SAT: max_time={max_time}, time_limit={time_limit}s")
    print(f"Beam search: beam_width={beam_width}, random_iterations={random_iterations}")
    print("=" * 80)

    results = []

    for i, config in enumerate(LARGE_PUZZLES):
        print(f"\n{'=' * 80}")
        print(f"PUZZLE {i}: {config.name}")
        print(f"Grid: {config.width}x{config.height}, Mirrors: {config.num_mirrors}")
        print(f"Laser: ({config.laser_x}, {config.laser_y}) -> {config.laser_dir.name}")
        print(f"Obstacles: {len(config.obstacles)}")
        print("=" * 80)

        # Calculate valid cells
        obstacle_set = set(config.obstacles)
        laser_pos = (config.laser_x, config.laser_y)
        valid_cells = [
            (x, y) for x in range(config.width) for y in range(config.height)
            if (x, y) not in obstacle_set and (x, y) != laser_pos
        ]
        print(f"Valid cells for mirrors: {len(valid_cells)}")

        # Run beam search baseline
        print(f"\n[1] Running beam search baseline...")
        beam_start = time.time()
        baseline = beam_search_solver(
            config,
            beam_width=beam_width,
            random_iterations=random_iterations,
            verbose=False
        )
        beam_time = time.time() - beam_start
        baseline_score = baseline['path_length']
        print(f"    Baseline score: {baseline_score}")
        print(f"    Time: {beam_time:.1f}s")
        print(f"    Mirrors: {baseline['mirrors']}")

        # Run CP-SAT solver
        print(f"\n[2] Running CP-SAT solver (time limit: {time_limit}s)...")
        cpsat_result = solve_puzzle(
            config,
            max_time=max_time,
            time_limit=time_limit,
            verbose=True
        )

        if cpsat_result is None:
            print("    CP-SAT: No solution found!")
            cpsat_score = 0
            cpsat_status = "NO_SOLUTION"
            cpsat_time = None
        else:
            cpsat_score = cpsat_result['path_length']
            cpsat_status = cpsat_result['status']
            cpsat_time = cpsat_result['solve_time']

            # Verify the solution
            if cpsat_result['mirrors']:
                verified = verify_solution(config, cpsat_result['mirrors'], cpsat_score)
                if not verified:
                    actual = simulate_laser(config, cpsat_result['mirrors'])
                    print(f"    WARNING: Verification failed!")
                    print(f"    Claimed: {cpsat_score}, Actual: {actual['length']}")

        # Compare results
        print(f"\n[3] Comparison:")
        print(f"    Beam search: {baseline_score} (in {beam_time:.1f}s)")
        print(f"    CP-SAT:      {cpsat_score} ({cpsat_status}, in {cpsat_time:.1f}s)" if cpsat_time else f"    CP-SAT:      {cpsat_score} ({cpsat_status})")

        if cpsat_score > baseline_score:
            improvement = cpsat_score - baseline_score
            pct = (improvement / baseline_score) * 100 if baseline_score > 0 else 0
            print(f"    >> CP-SAT found BETTER solution! +{improvement} (+{pct:.1f}%)")
            comparison = "BETTER"
        elif cpsat_score == baseline_score:
            print(f"    >> Solutions MATCH")
            comparison = "MATCH"
        else:
            diff = baseline_score - cpsat_score
            print(f"    >> Beam search found better solution (+{diff})")
            comparison = "WORSE"

        results.append({
            'name': config.name,
            'baseline': baseline_score,
            'baseline_time': beam_time,
            'cpsat': cpsat_score,
            'cpsat_status': cpsat_status,
            'cpsat_time': cpsat_time,
            'comparison': comparison,
        })

    # Summary
    print("\n")
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print()
    print(f"{'Puzzle':<20} {'Beam':>8} {'Time':>8} {'CP-SAT':>8} {'Status':>10} {'Time':>8} {'Result':>10}")
    print("-" * 80)

    for r in results:
        beam_time_str = f"{r['baseline_time']:.1f}s"
        cpsat_time_str = f"{r['cpsat_time']:.1f}s" if r['cpsat_time'] else "N/A"
        print(f"{r['name']:<20} {r['baseline']:>8} {beam_time_str:>8} {r['cpsat']:>8} {r['cpsat_status']:>10} {cpsat_time_str:>8} {r['comparison']:>10}")

    # Overall stats
    total_baseline = sum(r['baseline'] for r in results)
    total_cpsat = sum(r['cpsat'] for r in results)
    matches = sum(1 for r in results if r['comparison'] == 'MATCH')
    better = sum(1 for r in results if r['comparison'] == 'BETTER')
    worse = sum(1 for r in results if r['comparison'] == 'WORSE')
    optimal = sum(1 for r in results if r['cpsat_status'] == 'OPTIMAL')

    print("-" * 80)
    print(f"Total path lengths: Beam={total_baseline}, CP-SAT={total_cpsat}")
    print(f"Results: {len(results)} puzzles | Match: {matches} | Better: {better} | Worse: {worse}")
    print(f"Optimal solutions found: {optimal}/{len(results)}")

    return results


def test_single_puzzle(puzzle_index: int = 0, max_time: int = 300, time_limit: int = 600):
    """Test a single puzzle."""
    if puzzle_index >= len(LARGE_PUZZLES):
        print(f"Invalid puzzle index. Choose 0-{len(LARGE_PUZZLES)-1}")
        return

    config = LARGE_PUZZLES[puzzle_index]
    print(f"\nTesting: {config.name}")
    print(f"Grid: {config.width}x{config.height}")
    print(f"Mirrors: {config.num_mirrors}")
    print(f"Obstacles: {len(config.obstacles)}")
    print()

    # Beam search
    print("Running beam search...")
    baseline = beam_search_solver(config, beam_width=1000, random_iterations=50000, verbose=True)
    print(f"\nBeam search result: {baseline['path_length']}")
    print(f"Mirrors: {baseline['mirrors']}")

    # CP-SAT
    print(f"\nRunning CP-SAT solver (max_time={max_time}, limit={time_limit}s)...")
    result = solve_puzzle(config, max_time=max_time, time_limit=time_limit, verbose=True)

    if result:
        print(f"\nCP-SAT result: {result['path_length']} ({result['status']})")
        if result['mirrors']:
            actual = simulate_laser(config, result['mirrors'])
            print(f"Verified length: {actual['length']}")


if __name__ == '__main__':
    if len(sys.argv) > 1:
        if sys.argv[1] == '--single':
            idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
            test_single_puzzle(idx)
        else:
            # Custom time limit
            time_limit = int(sys.argv[1])
            max_time = int(sys.argv[2]) if len(sys.argv) > 2 else 300
            test_large_puzzles(max_time=max_time, time_limit=time_limit)
    else:
        # Default: max_time=300, time_limit=600
        test_large_puzzles(max_time=300, time_limit=600)

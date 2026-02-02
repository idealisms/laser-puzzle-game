#!/usr/bin/env pypy3
"""
Generate level JSON files for the laser puzzle game.
Computes optimal scores using beam search and outputs to solver/levels/

Usage:
    python generate_levels.py --date 2026-03-01           # Generate specific date
    python generate_levels.py --start 2026-03-01 --end 2026-03-07  # Generate date range
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from puzzles import PUZZLES, PuzzleConfig
from simulator import beam_search_solver


def get_puzzle_for_date(date_str: str) -> PuzzleConfig:
    """
    Get the puzzle configuration for a given date.
    Raises an error if no puzzle exists for the date.
    """
    if date_str not in PUZZLES:
        raise ValueError(
            f"No puzzle configured for {date_str}. "
            "Add a new puzzle to puzzles.py with this date as the key."
        )
    return PUZZLES[date_str]


def generate_level(date_str: str, config: PuzzleConfig) -> dict:
    """Generate a level for the given date using the provided puzzle config."""
    print(f"Computing optimal score for {date_str} ({config.name})...")
    result = beam_search_solver(config, verbose=False)
    optimal_score = result['path_length']
    print(f"  Optimal score: {optimal_score}")

    return {
        "date": date_str,
        "gridWidth": config.width,
        "gridHeight": config.height,
        "laserConfig": {
            "x": config.laser_x,
            "y": config.laser_y,
            "direction": config.laser_dir.to_string(),
        },
        "obstacles": [{"x": x, "y": y} for x, y in config.obstacles],
        "mirrorsAvailable": config.num_mirrors,
        "optimalScore": optimal_score,
    }


def generate_for_date(date_str: str, output_dir: Path):
    """Generate and save a level for a specific date."""
    config = get_puzzle_for_date(date_str)
    level = generate_level(date_str, config)

    output_path = output_dir / f"{date_str}.json"
    with open(output_path, "w") as f:
        json.dump(level, f, indent=2)
    print(f"  Saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate level JSON files")
    parser.add_argument(
        "--date",
        type=str,
        help="Generate a specific date (YYYY-MM-DD format)",
    )
    parser.add_argument(
        "--start",
        type=str,
        help="Start date for range generation (YYYY-MM-DD format)",
    )
    parser.add_argument(
        "--end",
        type=str,
        help="End date for range generation (YYYY-MM-DD format)",
    )
    args = parser.parse_args()

    # Validate arguments
    if not args.date and not (args.start and args.end):
        parser.error("Must specify either --date or both --start and --end")

    if args.date and (args.start or args.end):
        parser.error("Cannot use --date with --start/--end")

    if (args.start and not args.end) or (args.end and not args.start):
        parser.error("Must specify both --start and --end for range generation")

    # Create output directory
    output_dir = Path(__file__).parent / "levels"
    output_dir.mkdir(exist_ok=True)

    try:
        if args.start and args.end:
            # Generate date range
            start_date = datetime.strptime(args.start, "%Y-%m-%d")
            end_date = datetime.strptime(args.end, "%Y-%m-%d")
            current = start_date
            while current <= end_date:
                date_str = current.strftime("%Y-%m-%d")
                generate_for_date(date_str, output_dir)
                current += timedelta(days=1)
        else:
            # Generate single specific date
            generate_for_date(args.date, output_dir)

        print("\nDone!")
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

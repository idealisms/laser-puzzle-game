#!/usr/bin/env pypy3
"""
Generate level JSON files for the laser puzzle game.
Computes optimal scores using beam search and outputs to solver/levels/

Usage:
    python generate_levels.py                    # Generate 7 days (today and 6 days back)
    python generate_levels.py --days 30          # Generate 30 days
    python generate_levels.py --date 2026-02-01  # Generate specific date
    python generate_levels.py --start 2026-01-29 --end 2026-02-28  # Generate date range
"""

import argparse
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from puzzles import PUZZLES, ORIGINAL_PUZZLE_COUNT
from simulator import beam_search_solver

# Cutoff date: puzzles before this date use original puzzles (indices 0-6)
# Puzzles on or after this date use new puzzles only (indices 7+)
CUTOFF_DATE = datetime(2026, 1, 29)


def get_puzzle_index(date: datetime) -> int:
    """
    Get the puzzle index for a given date.

    For dates before CUTOFF_DATE (Jan 22-28, 2026):
        Uses original puzzles (indices 0-6) based on day of year % 7

    For dates on or after CUTOFF_DATE (Jan 29+):
        Uses new puzzles only (indices 7+) to avoid duplicates
    """
    if date < CUTOFF_DATE:
        # Original behavior for existing puzzles
        return date.timetuple().tm_yday % ORIGINAL_PUZZLE_COUNT
    else:
        # For new dates, use only new puzzles (starting at index 7)
        days_since_cutoff = (date - CUTOFF_DATE).days
        new_puzzle_count = len(PUZZLES) - ORIGINAL_PUZZLE_COUNT
        return ORIGINAL_PUZZLE_COUNT + (days_since_cutoff % new_puzzle_count)


def generate_level(date_str: str, puzzle_index: int) -> dict:
    """Generate a level for the given date using the puzzle at the given index."""
    config = PUZZLES[puzzle_index]

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


def generate_for_date(date: datetime, output_dir: Path):
    """Generate and save a level for a specific date."""
    date_str = date.strftime("%Y-%m-%d")
    puzzle_index = get_puzzle_index(date)
    level = generate_level(date_str, puzzle_index)

    output_path = output_dir / f"{date_str}.json"
    with open(output_path, "w") as f:
        json.dump(level, f, indent=2)
    print(f"  Saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate level JSON files")
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of days to generate (default: 7, going back from today)",
    )
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

    # Create output directory
    output_dir = Path(__file__).parent / "levels"
    output_dir.mkdir(exist_ok=True)

    if args.start and args.end:
        # Generate date range
        start_date = datetime.strptime(args.start, "%Y-%m-%d")
        end_date = datetime.strptime(args.end, "%Y-%m-%d")
        current = start_date
        while current <= end_date:
            generate_for_date(current, output_dir)
            current += timedelta(days=1)
    elif args.date:
        # Generate single specific date
        date = datetime.strptime(args.date, "%Y-%m-%d")
        generate_for_date(date, output_dir)
    else:
        # Generate multiple days going back from today
        today = datetime.now()

        for i in range(args.days - 1, -1, -1):
            date = today - timedelta(days=i)
            generate_for_date(date, output_dir)

    print("\nDone!")


if __name__ == "__main__":
    main()

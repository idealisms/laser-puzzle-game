#!/usr/bin/env pypy3
"""
Generate level JSON files for the laser puzzle game.
Computes optimal scores using beam search and outputs to solver/levels/

Usage:
    python generate_levels.py                    # Generate 7 days (today and 6 days back)
    python generate_levels.py --days 30          # Generate 30 days
    python generate_levels.py --date 2026-02-01  # Generate specific date
"""

import argparse
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from puzzles import PUZZLES
from simulator import beam_search_solver


def generate_level(date_str: str, puzzle_index: int) -> dict:
    """Generate a level for the given date using the puzzle at the given index."""
    config = PUZZLES[puzzle_index % len(PUZZLES)]

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
    args = parser.parse_args()

    # Create output directory
    output_dir = Path(__file__).parent / "levels"
    output_dir.mkdir(exist_ok=True)

    if args.date:
        # Generate single specific date
        date = datetime.strptime(args.date, "%Y-%m-%d")
        # Use day of year as puzzle index for consistency
        puzzle_index = date.timetuple().tm_yday % len(PUZZLES)
        level = generate_level(args.date, puzzle_index)

        output_path = output_dir / f"{args.date}.json"
        with open(output_path, "w") as f:
            json.dump(level, f, indent=2)
        print(f"  Saved to {output_path}")
    else:
        # Generate multiple days going back from today
        today = datetime.now()

        for i in range(args.days - 1, -1, -1):
            date = today - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")

            # Use day of year as puzzle index for consistency
            puzzle_index = date.timetuple().tm_yday % len(PUZZLES)
            level = generate_level(date_str, puzzle_index)

            output_path = output_dir / f"{date_str}.json"
            with open(output_path, "w") as f:
                json.dump(level, f, indent=2)
            print(f"  Saved to {output_path}")

    print("\nDone!")


if __name__ == "__main__":
    main()

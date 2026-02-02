"""
Puzzle configurations for the laser puzzle game.

Grid size: 15x20 with 8-11 mirrors for varied difficulty.

=== RULES FOR CREATING NEW PUZZLES ===

1. USE EACH WALL ARRANGEMENT ONCE
   - Each unique obstacle layout should only be used for one puzzle
   - Move used puzzles to used_puzzles.py after they've been assigned a date
   - Check used_puzzles.py before creating new arrangements

2. NO FULL BLOCKING WALLS
   - No contiguous wall should fully block the top from the bottom
   - No contiguous wall should fully block the left from the right
   - There must always be a path (even if convoluted) between all regions

3. NO LARGE UNREACHABLE ISLANDS
   - Any unreachable area should be at most 9 squares
   - An "island" is a contiguous group of cells completely surrounded by walls
   - This ensures the puzzle remains interesting with enough playable space

4. MINIMUM SOLUTION LENGTH
   - Solutions should be at least 10 squares long
   - This ensures puzzles are non-trivial and interesting
   - Run the solver to verify optimal path length before adding

=== ADDING NEW PUZZLES ===

1. Create new PuzzleConfig entries in the PUZZLES list below
2. Run `python generate_levels.py --date YYYY-MM-DD` to test
3. Verify the optimal score meets minimum requirements
4. After puzzles are used, move them to used_puzzles.py
"""

from typing import NamedTuple
from enum import IntEnum


class Direction(IntEnum):
    UP = 0
    RIGHT = 1
    DOWN = 2
    LEFT = 3

    @classmethod
    def from_string(cls, s: str) -> 'Direction':
        return {'up': cls.UP, 'right': cls.RIGHT, 'down': cls.DOWN, 'left': cls.LEFT}[s]

    def to_string(self) -> str:
        return {self.UP: 'up', self.RIGHT: 'right', self.DOWN: 'down', self.LEFT: 'left'}[self]


class PuzzleConfig(NamedTuple):
    name: str
    width: int
    height: int
    laser_x: int
    laser_y: int
    laser_dir: Direction
    obstacles: list[tuple[int, int]]
    num_mirrors: int


# Grid dimensions for all puzzles
GRID_WIDTH = 15
GRID_HEIGHT = 20

# Number of original puzzles (used for Jan 22-28, 2026)
# These should not be reused for new dates
ORIGINAL_PUZZLE_COUNT = 7

# All available puzzle configurations
# Add new puzzles here, then move to used_puzzles.py after use
#
# Currently empty - all 38 puzzles have been used:
# - Jan 22-28: 7 puzzles (indices 0-6 in used_puzzles.py)
# - Jan 29 - Feb 28: 31 puzzles (indices 7-37 in used_puzzles.py)
#
# New puzzles must be created following the rules above.
PUZZLES: list[PuzzleConfig] = [
    # Mar 1, 2026
    PuzzleConfig(
        name="River Bend",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Upper river bank (curved)
            (2, 4), (3, 4), (4, 5), (5, 5), (6, 6), (7, 6),
            (8, 6), (9, 5), (10, 5), (11, 4), (12, 4),
            # Lower river bank (curved, offset)
            (1, 8), (2, 8), (3, 9), (4, 9), (5, 10), (6, 10),
            (7, 10), (8, 10), (9, 9), (10, 9), (11, 8), (12, 8), (13, 8),
            # Second bend - upper bank
            (2, 13), (3, 13), (4, 12), (5, 12), (6, 12),
            (7, 13), (8, 13), (9, 14), (10, 14), (11, 14),
            # Second bend - lower bank
            (1, 16), (2, 17), (3, 17), (4, 16), (5, 16),
            (6, 16), (7, 17), (8, 17), (9, 18), (10, 18), (11, 17), (12, 17),
        ],
        num_mirrors=10,
    ),
    # Mar 2, 2026
    PuzzleConfig(
        name="Scattered Stones",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=7,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Single stones and small clusters spread across grid
            # Top region
            (2, 2), (3, 3),
            (8, 1), (9, 2),
            (12, 3), (13, 2),
            # Upper-middle region
            (1, 6), (2, 7),
            (5, 5), (6, 6),
            (10, 7), (11, 6),
            (14, 5),
            # Center region
            (0, 10), (1, 11),
            (4, 9), (5, 10), (4, 11),
            (8, 10), (9, 9), (9, 11),
            (12, 10), (13, 11),
            # Lower-middle region
            (2, 14), (3, 13),
            (6, 14), (7, 15),
            (10, 13), (11, 14),
            (14, 14),
            # Bottom region
            (1, 17), (2, 18),
            (5, 17), (6, 18),
            (9, 17), (10, 18),
            (12, 17), (13, 17),
        ],
        num_mirrors=9,
    ),
]

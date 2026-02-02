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
    # Add new puzzles here following the rules documented above
]

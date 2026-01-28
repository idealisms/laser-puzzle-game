"""
Puzzle configurations extracted from the game.
These are the 7 level templates used by the seed script.
Grid size: 15x20 with 8-11 mirrors for varied difficulty.
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

# All 7 puzzle configurations from prisma/seed.ts (15x20 grids)
PUZZLES = [
    PuzzleConfig(
        name="Spiral Inward",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Outer wall (top, leaving gap at right)
            *[(i, 2) for i in range(13)],
            # Right wall going down
            *[(13, i + 2) for i in range(15)],
            # Bottom wall going left
            *[(i + 3, 17) for i in range(11)],
            # Left wall going up
            *[(3, i + 5) for i in range(13)],
            # Inner spiral
            *[(i + 3, 5) for i in range(8)],
            *[(10, i + 5) for i in range(9)],
            *[(i + 6, 14) for i in range(5)],
            *[(6, i + 8) for i in range(7)],
            *[(i + 6, 8) for i in range(3)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Chamber Grid",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=8,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Vertical dividers (with gaps for passages)
            *[(4, i) for i in range(5)],
            *[(4, i + 7) for i in range(4)],
            *[(4, i + 13) for i in range(5)],
            *[(9, i + 1) for i in range(5)],
            *[(9, i + 8) for i in range(4)],
            *[(9, i + 14) for i in range(5)],
            # Horizontal dividers (with gaps)
            *[(i + 1, 5) for i in range(3)],
            *[(i + 6, 5) for i in range(3)],
            *[(i + 11, 5) for i in range(3)],
            *[(i + 1, 12) for i in range(3)],
            *[(i + 6, 12) for i in range(3)],
            *[(i + 11, 12) for i in range(3)],
            *[(i + 1, 17) for i in range(3)],
            *[(i + 6, 17) for i in range(3)],
            *[(i + 11, 17) for i in range(3)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Diagonal Barriers",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=19,
        laser_dir=Direction.UP,
        obstacles=[
            # Diagonal barrier 1 (bottom-left to middle)
            (2, 17), (3, 16), (4, 15), (5, 14), (6, 13),
            # Diagonal barrier 2 (right side)
            (12, 15), (11, 14), (10, 13), (9, 12), (8, 11),
            # Diagonal barrier 3
            (3, 9), (4, 8), (5, 7), (6, 6), (7, 5),
            # Diagonal barrier 4
            (11, 7), (10, 6), (9, 5), (8, 4), (7, 3),
            # Diagonal barrier 5 (top)
            (2, 3), (3, 2), (4, 1), (5, 0),
            (12, 2), (13, 1), (14, 0),
            # Some blocking walls
            (0, 10), (1, 10),
            (13, 10), (14, 10),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Fortress",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=7,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Central fortress walls
            (5, 8), (6, 8), (7, 8), (8, 8), (9, 8),
            (5, 9), (9, 9),
            (5, 10), (9, 10),
            (5, 11), (6, 11), (7, 11), (8, 11), (9, 11),
            # Outer defense - top
            (3, 4), (4, 4), (5, 4), (9, 4), (10, 4), (11, 4),
            # Outer defense - bottom
            (3, 15), (4, 15), (5, 15), (9, 15), (10, 15), (11, 15),
            # Side towers
            *[(1, i + 6) for i in range(8)],
            *[(13, i + 6) for i in range(8)],
            # Corner blocks
            (0, 0), (1, 0), (0, 1),
            (13, 0), (14, 0), (14, 1),
            (0, 18), (0, 19), (1, 19),
            (14, 18), (14, 19), (13, 19),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Labyrinth",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=1,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Horizontal walls
            *[(i + 2, 3) for i in range(6)],
            *[(i + 10, 3) for i in range(5)],
            *[(i, 6) for i in range(5)],
            *[(i + 7, 6) for i in range(5)],
            *[(i + 3, 9) for i in range(6)],
            *[(i + 11, 9) for i in range(4)],
            *[(i, 12) for i in range(4)],
            *[(i + 6, 12) for i in range(5)],
            *[(i + 13, 12) for i in range(2)],
            *[(i + 2, 15) for i in range(5)],
            *[(i + 9, 15) for i in range(5)],
            *[(i, 18) for i in range(5)],
            *[(i + 7, 18) for i in range(3)],
            *[(i + 12, 18) for i in range(3)],
        ],
        num_mirrors=11,
    ),
    PuzzleConfig(
        name="Scattered Islands",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=14,
        laser_y=10,
        laser_dir=Direction.LEFT,
        obstacles=[
            # Island 1 (top-left)
            (1, 2), (2, 2), (3, 2), (2, 3), (2, 4),
            # Island 2 (top-right)
            (11, 1), (12, 1), (11, 2), (12, 2), (13, 2),
            # Island 3 (middle-left)
            (0, 8), (1, 8), (2, 8), (1, 9), (0, 10), (1, 10),
            # Island 4 (center)
            (6, 9), (7, 9), (8, 9), (6, 10), (8, 10), (6, 11), (7, 11), (8, 11),
            # Island 5 (middle-right)
            (12, 7), (13, 7), (12, 8), (13, 8), (14, 8),
            # Island 6 (bottom-left)
            (2, 15), (3, 15), (4, 15), (3, 16), (3, 17), (4, 17),
            # Island 7 (bottom-center)
            (8, 16), (9, 16), (10, 16), (9, 17),
            # Island 8 (bottom-right)
            (12, 14), (13, 14), (12, 15), (13, 15), (14, 15),
        ],
        num_mirrors=9,
    ),
    PuzzleConfig(
        name="Gauntlet",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Alternating horizontal barriers
            *[(i + 2, 3) for i in range(10)],
            *[(i + 3, 7) for i in range(10)],
            *[(i + 2, 11) for i in range(10)],
            *[(i + 3, 15) for i in range(10)],
            # Side barriers
            *[(0, i + 5) for i in range(3)],
            *[(14, i + 9) for i in range(3)],
            *[(0, i + 13) for i in range(3)],
            *[(14, i + 17) for i in range(3)],
        ],
        num_mirrors=8,
    ),
]

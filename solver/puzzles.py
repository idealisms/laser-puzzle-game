"""
Puzzle configurations extracted from the game.
These are the 7 level templates used by the seed script.
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


class PuzzleConfig(NamedTuple):
    name: str
    width: int
    height: int
    laser_x: int
    laser_y: int
    laser_dir: Direction
    obstacles: list[tuple[int, int]]
    num_mirrors: int


# All 7 puzzle configurations from the game
PUZZLES = [
    PuzzleConfig(
        name="Corridor Run",
        width=10,
        height=10,
        laser_x=0,
        laser_y=1,
        laser_dir=Direction.RIGHT,
        obstacles=[
            (2, 0), (3, 0), (4, 0),
            (2, 2), (3, 2), (4, 2),
            (6, 3), (7, 3), (8, 3),
            (6, 5), (7, 5), (8, 5),
            (1, 7), (2, 7), (3, 7),
        ],
        num_mirrors=5,
    ),
    PuzzleConfig(
        name="Zigzag Barriers",
        width=10,
        height=10,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.RIGHT,
        obstacles=[
            (3, 0), (3, 1), (3, 2),
            (5, 3), (5, 4), (5, 5),
            (7, 6), (7, 7), (7, 8),
            (2, 5), (2, 6),
            (8, 2), (9, 2),
        ],
        num_mirrors=6,
    ),
    PuzzleConfig(
        name="Central Fortress",
        width=10,
        height=10,
        laser_x=0,
        laser_y=5,
        laser_dir=Direction.RIGHT,
        obstacles=[
            (4, 3), (5, 3), (6, 3),
            (4, 4), (6, 4),
            (4, 5), (6, 5),
            (4, 6), (5, 6), (6, 6),
            (2, 2), (8, 2),
            (2, 8), (8, 8),
        ],
        num_mirrors=5,
    ),
    PuzzleConfig(
        name="Scattered Maze",
        width=10,
        height=10,
        laser_x=0,
        laser_y=2,
        laser_dir=Direction.RIGHT,
        obstacles=[
            (2, 1), (2, 2), (2, 3),
            (4, 0), (4, 1),
            (6, 4), (6, 5), (7, 5),
            (3, 6), (3, 7), (4, 7),
            (8, 1), (8, 2),
            (5, 8), (6, 8), (7, 8),
        ],
        num_mirrors=6,
    ),
    PuzzleConfig(
        name="Cross Pattern",
        width=10,
        height=10,
        laser_x=0,
        laser_y=9,
        laser_dir=Direction.UP,
        obstacles=[
            (5, 2), (5, 3), (5, 4),
            (5, 6), (5, 7), (5, 8),
            (2, 5), (3, 5), (4, 5),
            (6, 5), (7, 5), (8, 5),
            (1, 1), (9, 1),
            (1, 9), (9, 9),
        ],
        num_mirrors=5,
    ),
    PuzzleConfig(
        name="Spiral Walls",
        width=10,
        height=10,
        laser_x=9,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1),
            (1, 2), (1, 3), (1, 4), (1, 5),
            (3, 3), (4, 3), (5, 3), (6, 3), (7, 3),
            (7, 4), (7, 5),
            (3, 7), (4, 7), (5, 7),
        ],
        num_mirrors=6,
    ),
    PuzzleConfig(
        name="Chamber Maze",
        width=10,
        height=10,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            (2, 0), (2, 1), (2, 2), (2, 3),
            (4, 2), (5, 2), (6, 2),
            (6, 3), (6, 4), (6, 5),
            (3, 5), (4, 5), (5, 5),
            (3, 6), (3, 7), (3, 8),
            (8, 4), (8, 5), (8, 6), (8, 7),
            (5, 8), (6, 8), (7, 8),
        ],
        num_mirrors=7,
    ),
]

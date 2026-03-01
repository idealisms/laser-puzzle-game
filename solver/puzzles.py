"""
Puzzle configurations for the laser puzzle game.

Grid size: 15x20 with 8-11 mirrors for varied difficulty.

=== RULES FOR CREATING NEW PUZZLES ===

1. USE EACH WALL ARRANGEMENT ONCE
   - Each unique obstacle layout should only be used for one puzzle
   - Each puzzle has an assigned date and cannot be reused

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

1. Create a new JSON file in solver/puzzles/YYYY-MM-DD.json using the schema
   in an existing file as a template.  obstacle_groups preserves the comments
   from the old hardcoded format as "label" strings.
2. Run `pypy3 generate_levels.py --date YYYY-MM-DD` to generate the level JSON
3. Verify the optimal score meets minimum requirements
4. Run `npm run db:seed` with .env.production to insert levels into the prod database
"""

import json
from pathlib import Path
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
    splitters: list[tuple[int, int, str]] = []  # (x, y, orientation) where orientation ∈ {'right','left','up','down'}


# Grid dimensions for all puzzles
GRID_WIDTH = 15
GRID_HEIGHT = 20


def _load_puzzles() -> dict[str, PuzzleConfig]:
    """Load all puzzle configs from solver/puzzles/*.json."""
    puzzles_dir = Path(__file__).parent / 'puzzles'
    configs: dict[str, PuzzleConfig] = {}
    for path in sorted(puzzles_dir.glob('*.json')):
        data = json.loads(path.read_text())
        date = data['date']
        obstacles = [
            tuple(cell)
            for group in data['obstacle_groups']
            for cell in group['cells']
        ]
        splitters = [
            (s['x'], s['y'], s['dir'])
            for s in data.get('splitters', [])
        ]
        configs[date] = PuzzleConfig(
            name=data['name'],
            width=data['width'],
            height=data['height'],
            laser_x=data['laser']['x'],
            laser_y=data['laser']['y'],
            laser_dir=Direction.from_string(data['laser']['dir']),
            obstacles=obstacles,
            num_mirrors=data['num_mirrors'],
            splitters=splitters,
        )
    return configs


# All puzzle configurations keyed by date (YYYY-MM-DD)
PUZZLES: dict[str, PuzzleConfig] = _load_puzzles()

"""
Large puzzle configurations (15x20 grids with up to 10 mirrors).
These are more challenging puzzles to test solver scalability.
"""

from puzzles import PuzzleConfig, Direction


LARGE_PUZZLES = [
    # Puzzle 0: Spiral Inward
    # A spiral pattern that forces the laser to wind through the grid
    PuzzleConfig(
        name="Spiral Inward",
        width=15,
        height=20,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Outer wall (top, leaving gap at right)
            *[(x, 2) for x in range(0, 13)],
            # Right wall going down
            *[(13, y) for y in range(2, 17)],
            # Bottom wall going left
            *[(x, 17) for x in range(3, 14)],
            # Left wall going up
            *[(3, y) for y in range(5, 18)],
            # Inner spiral
            *[(x, 5) for x in range(3, 11)],
            *[(10, y) for y in range(5, 14)],
            *[(x, 14) for x in range(6, 11)],
            *[(6, y) for y in range(8, 15)],
            *[(x, 8) for x in range(6, 9)],
        ],
        num_mirrors=10,
    ),

    # Puzzle 1: Chamber Grid
    # A grid of interconnected chambers
    PuzzleConfig(
        name="Chamber Grid",
        width=15,
        height=20,
        laser_x=0,
        laser_y=10,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Vertical dividers
            *[(4, y) for y in range(0, 7)],
            *[(4, y) for y in range(9, 14)],
            *[(4, y) for y in range(16, 20)],
            *[(9, y) for y in range(2, 8)],
            *[(9, y) for y in range(10, 18)],
            # Horizontal dividers
            *[(x, 5) for x in range(0, 3)],
            *[(x, 5) for x in range(6, 8)],
            *[(x, 5) for x in range(11, 15)],
            *[(x, 10) for x in range(1, 4)],
            *[(x, 10) for x in range(6, 9)],
            *[(x, 10) for x in range(11, 14)],
            *[(x, 15) for x in range(0, 3)],
            *[(x, 15) for x in range(5, 9)],
            *[(x, 15) for x in range(11, 15)],
        ],
        num_mirrors=10,
    ),

    # Puzzle 2: Diagonal Barriers
    # Staggered diagonal walls creating a zigzag path
    PuzzleConfig(
        name="Diagonal Barriers",
        width=15,
        height=20,
        laser_x=0,
        laser_y=19,
        laser_dir=Direction.UP,
        obstacles=[
            # Diagonal barrier 1 (bottom-left to middle)
            *[(2, 17), (3, 16), (4, 15), (5, 14), (6, 13)],
            # Diagonal barrier 2 (right side)
            *[(12, 15), (11, 14), (10, 13), (9, 12), (8, 11)],
            # Diagonal barrier 3
            *[(3, 9), (4, 8), (5, 7), (6, 6), (7, 5)],
            # Diagonal barrier 4
            *[(11, 7), (10, 6), (9, 5), (8, 4), (7, 3)],
            # Diagonal barrier 5 (top)
            *[(2, 3), (3, 2), (4, 1), (5, 0)],
            *[(12, 2), (13, 1), (14, 0)],
            # Some blocking walls
            *[(0, 10), (1, 10)],
            *[(13, 10), (14, 10)],
        ],
        num_mirrors=10,
    ),

    # Puzzle 3: Fortress
    # A central fortress with outer defenses
    PuzzleConfig(
        name="Fortress",
        width=15,
        height=20,
        laser_x=7,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Central fortress walls
            *[(5, 8), (6, 8), (7, 8), (8, 8), (9, 8)],
            *[(5, 9), (9, 9)],
            *[(5, 10), (9, 10)],
            *[(5, 11), (6, 11), (7, 11), (8, 11), (9, 11)],
            # Outer defense - top
            *[(3, 4), (4, 4), (5, 4), (9, 4), (10, 4), (11, 4)],
            # Outer defense - bottom
            *[(3, 15), (4, 15), (5, 15), (9, 15), (10, 15), (11, 15)],
            # Side towers
            *[(1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12), (1, 13)],
            *[(13, 6), (13, 7), (13, 8), (13, 9), (13, 10), (13, 11), (13, 12), (13, 13)],
            # Corner blocks
            *[(0, 0), (1, 0), (0, 1)],
            *[(13, 0), (14, 0), (14, 1)],
            *[(0, 18), (0, 19), (1, 19)],
            *[(14, 18), (14, 19), (13, 19)],
        ],
        num_mirrors=10,
    ),

    # Puzzle 4: Labyrinth
    # A maze-like pattern with many corridors
    PuzzleConfig(
        name="Labyrinth",
        width=15,
        height=20,
        laser_x=0,
        laser_y=1,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Horizontal walls
            *[(x, 3) for x in range(2, 8)],
            *[(x, 3) for x in range(10, 15)],
            *[(x, 6) for x in range(0, 5)],
            *[(x, 6) for x in range(7, 12)],
            *[(x, 9) for x in range(3, 9)],
            *[(x, 9) for x in range(11, 15)],
            *[(x, 12) for x in range(0, 4)],
            *[(x, 12) for x in range(6, 11)],
            *[(x, 12) for x in range(13, 15)],
            *[(x, 15) for x in range(2, 7)],
            *[(x, 15) for x in range(9, 14)],
            *[(x, 18) for x in range(0, 5)],
            *[(x, 18) for x in range(7, 10)],
            *[(x, 18) for x in range(12, 15)],
        ],
        num_mirrors=10,
    ),

    # Puzzle 5: Scattered Islands
    # Random-looking clusters of obstacles
    PuzzleConfig(
        name="Scattered Islands",
        width=15,
        height=20,
        laser_x=14,
        laser_y=10,
        laser_dir=Direction.LEFT,
        obstacles=[
            # Island 1 (top-left)
            *[(1, 2), (2, 2), (3, 2), (2, 3), (2, 4)],
            # Island 2 (top-right)
            *[(11, 1), (12, 1), (11, 2), (12, 2), (13, 2)],
            # Island 3 (middle-left)
            *[(0, 8), (1, 8), (2, 8), (1, 9), (0, 10), (1, 10)],
            # Island 4 (center)
            *[(6, 9), (7, 9), (8, 9), (6, 10), (8, 10), (6, 11), (7, 11), (8, 11)],
            # Island 5 (middle-right)
            *[(12, 7), (13, 7), (12, 8), (13, 8), (14, 8)],
            # Island 6 (bottom-left)
            *[(2, 15), (3, 15), (4, 15), (3, 16), (3, 17), (4, 17)],
            # Island 7 (bottom-center)
            *[(8, 16), (9, 16), (10, 16), (9, 17)],
            # Island 8 (bottom-right)
            *[(12, 14), (13, 14), (12, 15), (13, 15), (14, 15)],
        ],
        num_mirrors=10,
    ),
]

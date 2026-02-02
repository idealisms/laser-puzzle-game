"""
Used puzzle configurations - DO NOT REUSE.

These wall arrangements have already been used for daily puzzles.
Each wall arrangement should only be used once.

Usage dates:
- Indices 0-6: Jan 22-28, 2026
- Indices 7-37: Jan 29 - Feb 28, 2026
"""

from puzzles import PuzzleConfig, Direction, GRID_WIDTH, GRID_HEIGHT


USED_PUZZLES = [
    # === ORIGINAL PUZZLES (Jan 22-28, 2026) ===
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
    # === NEW PUZZLES (Jan 29 - Feb 28, 2026) ===
    PuzzleConfig(
        name="Cross Roads",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=5,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Vertical cross arm
            *[(7, i) for i in range(6)],
            *[(7, i + 14) for i in range(6)],
            # Horizontal cross arm
            *[(i, 10) for i in range(5)],
            *[(i + 10, 10) for i in range(5)],
            # Corner blocks
            (2, 2), (3, 2), (2, 3),
            (11, 2), (12, 2), (12, 3),
            (2, 17), (3, 17), (2, 16),
            (11, 17), (12, 17), (12, 16),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Zigzag Valley",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Zigzag walls
            *[(i, 4) for i in range(8)],
            *[(i + 7, 8) for i in range(8)],
            *[(i, 12) for i in range(8)],
            *[(i + 7, 16) for i in range(8)],
            # Vertical connectors
            (7, 5), (7, 6), (7, 7),
            (7, 13), (7, 14), (7, 15),
        ],
        num_mirrors=9,
    ),
    PuzzleConfig(
        name="Concentric Boxes",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=14,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Outer box (with gaps)
            *[(i + 1, 2) for i in range(6)],
            *[(i + 8, 2) for i in range(6)],
            *[(i + 1, 17) for i in range(6)],
            *[(i + 8, 17) for i in range(6)],
            *[(1, i + 3) for i in range(6)],
            *[(1, i + 11) for i in range(6)],
            *[(13, i + 3) for i in range(6)],
            *[(13, i + 11) for i in range(6)],
            # Inner box
            *[(i + 5, 7) for i in range(5)],
            *[(i + 5, 12) for i in range(5)],
            *[(5, i + 8) for i in range(4)],
            *[(9, i + 8) for i in range(4)],
        ],
        num_mirrors=11,
    ),
    PuzzleConfig(
        name="Checkerboard",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=12,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # 2x2 blocks in checkerboard pattern
            *[(i + 1, j + 1) for i in range(2) for j in range(2)],
            *[(i + 6, j + 1) for i in range(2) for j in range(2)],
            *[(i + 11, j + 1) for i in range(2) for j in range(2)],
            *[(i + 3, j + 5) for i in range(2) for j in range(2)],
            *[(i + 8, j + 5) for i in range(2) for j in range(2)],
            *[(i + 1, j + 9) for i in range(2) for j in range(2)],
            *[(i + 6, j + 9) for i in range(2) for j in range(2)],
            *[(i + 11, j + 9) for i in range(2) for j in range(2)],
            *[(i + 3, j + 13) for i in range(2) for j in range(2)],
            *[(i + 8, j + 13) for i in range(2) for j in range(2)],
            *[(i + 1, j + 17) for i in range(2) for j in range(2)],
            *[(i + 6, j + 17) for i in range(2) for j in range(2)],
            *[(i + 11, j + 17) for i in range(2) for j in range(2)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Arrow",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=7,
        laser_y=19,
        laser_dir=Direction.UP,
        obstacles=[
            # Arrow head pointing up
            (7, 2),
            (6, 3), (8, 3),
            (5, 4), (9, 4),
            (4, 5), (10, 5),
            (3, 6), (11, 6),
            (2, 7), (12, 7),
            # Arrow shaft
            *[(6, i + 8) for i in range(8)],
            *[(8, i + 8) for i in range(8)],
            # Feathers at bottom
            (4, 16), (5, 17), (4, 18),
            (10, 16), (9, 17), (10, 18),
        ],
        num_mirrors=9,
    ),
    PuzzleConfig(
        name="Staircase",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=19,
        laser_dir=Direction.UP,
        obstacles=[
            # Ascending stairs from bottom-left
            *[(i, 17) for i in range(3)],
            *[(i + 2, 14) for i in range(3)],
            *[(i + 4, 11) for i in range(3)],
            *[(i + 6, 8) for i in range(3)],
            *[(i + 8, 5) for i in range(3)],
            *[(i + 10, 2) for i in range(3)],
            # Stair risers
            (2, 15), (2, 16),
            (4, 12), (4, 13),
            (6, 9), (6, 10),
            (8, 6), (8, 7),
            (10, 3), (10, 4),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Window Frame",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=3,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Outer frame
            *[(i, 0) for i in range(15)],
            *[(i, 19) for i in range(15)],
            *[(0, i + 1) for i in range(18)],
            *[(14, i + 1) for i in range(18)],
            # Window panes (cross dividers)
            *[(7, i + 2) for i in range(7)],
            *[(7, i + 12) for i in range(7)],
            *[(i + 2, 10) for i in range(5)],
            *[(i + 9, 10) for i in range(5)],
        ],
        num_mirrors=11,
    ),
    PuzzleConfig(
        name="Tunnel Run",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=7,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Left tunnel wall
            *[(3, i) for i in range(8)],
            *[(3, i + 12) for i in range(8)],
            # Right tunnel wall
            *[(11, i) for i in range(8)],
            *[(11, i + 12) for i in range(8)],
            # Obstacles in tunnel
            (5, 3), (9, 3),
            (6, 6), (8, 6),
            (7, 9), (7, 10),
            (6, 13), (8, 13),
            (5, 16), (9, 16),
        ],
        num_mirrors=9,
    ),
    PuzzleConfig(
        name="Pinwheel",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=10,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Center hub
            (6, 9), (7, 9), (8, 9),
            (6, 10), (8, 10),
            (6, 11), (7, 11), (8, 11),
            # Blades extending from center
            *[(i + 9, 8) for i in range(4)],  # Right blade
            *[(i + 2, 12) for i in range(4)],  # Left blade
            *[(7, i + 2) for i in range(4)],   # Top blade
            *[(7, i + 14) for i in range(4)],  # Bottom blade
            # Corner accents
            (1, 1), (2, 2),
            (12, 1), (13, 2),
            (1, 18), (2, 17),
            (12, 18), (13, 17),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Wave Pattern",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Wave 1
            (1, 2), (2, 3), (3, 4), (4, 3), (5, 2),
            (6, 3), (7, 4), (8, 3), (9, 2),
            (10, 3), (11, 4), (12, 3), (13, 2),
            # Wave 2
            (1, 9), (2, 10), (3, 11), (4, 10), (5, 9),
            (6, 10), (7, 11), (8, 10), (9, 9),
            (10, 10), (11, 11), (12, 10), (13, 9),
            # Wave 3
            (1, 16), (2, 17), (3, 18), (4, 17), (5, 16),
            (6, 17), (7, 18), (8, 17), (9, 16),
            (10, 17), (11, 18), (12, 17), (13, 16),
        ],
        num_mirrors=8,
    ),
    PuzzleConfig(
        name="Pillars",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=14,
        laser_y=19,
        laser_dir=Direction.LEFT,
        obstacles=[
            # Scattered pillars (2x2 blocks)
            *[(i + 2, j + 2) for i in range(2) for j in range(2)],
            *[(i + 8, j + 3) for i in range(2) for j in range(2)],
            *[(i + 12, j + 1) for i in range(2) for j in range(2)],
            *[(i + 4, j + 8) for i in range(2) for j in range(2)],
            *[(i + 10, j + 9) for i in range(2) for j in range(2)],
            *[(i + 1, j + 14) for i in range(2) for j in range(2)],
            *[(i + 6, j + 15) for i in range(2) for j in range(2)],
            *[(i + 11, j + 16) for i in range(2) for j in range(2)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="T-Junction",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=15,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Main T shape
            *[(i + 2, 5) for i in range(11)],  # Top of T
            *[(7, i + 6) for i in range(10)],  # Stem of T
            # Additional T shapes
            *[(i + 3, 1) for i in range(4)],
            (5, 2), (5, 3), (5, 4),
            *[(i + 9, 1) for i in range(4)],
            (11, 2), (11, 3), (11, 4),
            # Bottom T
            *[(i + 2, 17) for i in range(11)],
            (7, 18), (7, 19),
        ],
        num_mirrors=9,
    ),
    PuzzleConfig(
        name="Serpentine",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=7,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # S-curve walls
            *[(i + 2, 3) for i in range(6)],
            (7, 4), (7, 5), (7, 6),
            *[(i + 7, 7) for i in range(6)],
            (7, 8), (7, 9), (7, 10),
            *[(i + 2, 11) for i in range(6)],
            (7, 12), (7, 13), (7, 14),
            *[(i + 7, 15) for i in range(6)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Diamond",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=7,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Diamond outline
            (7, 2),
            (6, 3), (8, 3),
            (5, 4), (9, 4),
            (4, 5), (10, 5),
            (3, 6), (11, 6),
            (2, 7), (12, 7),
            (1, 8), (13, 8),
            (1, 9), (13, 9),
            (1, 10), (13, 10),
            (1, 11), (13, 11),
            (2, 12), (12, 12),
            (3, 13), (11, 13),
            (4, 14), (10, 14),
            (5, 15), (9, 15),
            (6, 16), (8, 16),
            (7, 17),
        ],
        num_mirrors=11,
    ),
    PuzzleConfig(
        name="Bridge",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=5,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # River (horizontal gap area markers)
            *[(i, 9) for i in range(4)],
            *[(i + 11, 9) for i in range(4)],
            *[(i, 11) for i in range(4)],
            *[(i + 11, 11) for i in range(4)],
            # Bridge pillars
            (5, 8), (5, 12),
            (9, 8), (9, 12),
            # Banks
            *[(i + 1, 6) for i in range(5)],
            *[(i + 9, 6) for i in range(5)],
            *[(i + 1, 14) for i in range(5)],
            *[(i + 9, 14) for i in range(5)],
            # Approach paths
            (2, 2), (3, 2), (4, 2),
            (10, 2), (11, 2), (12, 2),
            (2, 17), (3, 17), (4, 17),
            (10, 17), (11, 17), (12, 17),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Maze Runner",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=1,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Complex maze walls
            *[(i + 2, 2) for i in range(4)],
            (5, 3), (5, 4), (5, 5),
            *[(i + 5, 5) for i in range(4)],
            (8, 6), (8, 7),
            *[(i + 8, 7) for i in range(5)],
            *[(i + 1, 9) for i in range(5)],
            (1, 10), (1, 11),
            *[(i + 1, 11) for i in range(4)],
            (4, 12), (4, 13), (4, 14),
            *[(i + 4, 14) for i in range(6)],
            (9, 15), (9, 16),
            *[(i + 9, 16) for i in range(4)],
            *[(i + 1, 17) for i in range(4)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Honeycomb",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=14,
        laser_y=10,
        laser_dir=Direction.LEFT,
        obstacles=[
            # Hexagonal-ish cells
            # Cell 1
            (2, 1), (3, 1), (1, 2), (4, 2), (1, 3), (4, 3), (2, 4), (3, 4),
            # Cell 2
            (7, 1), (8, 1), (6, 2), (9, 2), (6, 3), (9, 3), (7, 4), (8, 4),
            # Cell 3
            (12, 1), (13, 1), (11, 2), (14, 2), (11, 3), (14, 3), (12, 4), (13, 4),
            # Cell 4
            (4, 7), (5, 7), (3, 8), (6, 8), (3, 9), (6, 9), (4, 10), (5, 10),
            # Cell 5
            (9, 7), (10, 7), (8, 8), (11, 8), (8, 9), (11, 9), (9, 10), (10, 10),
            # Cell 6
            (2, 13), (3, 13), (1, 14), (4, 14), (1, 15), (4, 15), (2, 16), (3, 16),
            # Cell 7
            (12, 13), (13, 13), (11, 14), (14, 14), (11, 15), (14, 15), (12, 16), (13, 16),
        ],
        num_mirrors=9,
    ),
    PuzzleConfig(
        name="Hourglass",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=10,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Top triangle (narrower, with gap at center)
            *[(i + 2, 2) for i in range(5)],
            *[(i + 8, 2) for i in range(5)],
            *[(i + 3, 4) for i in range(4)],
            *[(i + 8, 4) for i in range(4)],
            *[(i + 4, 6) for i in range(3)],
            *[(i + 8, 6) for i in range(3)],
            *[(i + 5, 8) for i in range(2)],
            *[(i + 8, 8) for i in range(2)],
            # Bottom triangle (inverted)
            *[(i + 5, 12) for i in range(2)],
            *[(i + 8, 12) for i in range(2)],
            *[(i + 4, 14) for i in range(3)],
            *[(i + 8, 14) for i in range(3)],
            *[(i + 3, 16) for i in range(4)],
            *[(i + 8, 16) for i in range(4)],
            *[(i + 2, 18) for i in range(5)],
            *[(i + 8, 18) for i in range(5)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Castle",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=15,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Castle towers (top)
            (1, 1), (2, 1), (1, 2), (2, 2),
            (6, 1), (7, 1), (8, 1), (6, 2), (8, 2),
            (12, 1), (13, 1), (12, 2), (13, 2),
            # Battlements
            *[(i + 1, 4) for i in range(13)],
            # Castle walls
            *[(1, i + 5) for i in range(10)],
            *[(13, i + 5) for i in range(10)],
            # Inner courtyard walls
            (4, 7), (4, 8), (4, 9),
            (10, 7), (10, 8), (10, 9),
            *[(i + 5, 10) for i in range(5)],
            # Gate
            (6, 14), (8, 14),
            *[(i + 5, 15) for i in range(5)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Vortex",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Spiral arms emanating from center
            # Arm 1 (top-right)
            (8, 8), (9, 7), (10, 6), (11, 5), (12, 4), (13, 3),
            # Arm 2 (bottom-right)
            (8, 11), (9, 12), (10, 13), (11, 14), (12, 15), (13, 16),
            # Arm 3 (bottom-left)
            (6, 11), (5, 12), (4, 13), (3, 14), (2, 15), (1, 16),
            # Arm 4 (top-left)
            (6, 8), (5, 7), (4, 6), (3, 5), (2, 4), (1, 3),
            # Center
            (7, 9), (7, 10),
        ],
        num_mirrors=11,
    ),
    PuzzleConfig(
        name="Railroad",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=3,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Track rails (with gaps for crossing)
            *[(i, 8) for i in range(6)],
            *[(i + 9, 8) for i in range(6)],
            *[(i, 12) for i in range(6)],
            *[(i + 9, 12) for i in range(6)],
            # Cross ties
            (2, 9), (2, 11),
            (4, 9), (4, 11),
            (10, 9), (10, 11),
            (12, 9), (12, 11),
            # Station platforms
            *[(i + 4, 2) for i in range(3)],
            *[(i + 4, 4) for i in range(3)],
            *[(i + 8, 15) for i in range(3)],
            *[(i + 8, 17) for i in range(3)],
            # Waiting areas
            (1, 6), (2, 6),
            (12, 6), (13, 6),
            (1, 14), (2, 14),
            (12, 14), (13, 14),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Lightning",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=7,
        laser_y=19,
        laser_dir=Direction.UP,
        obstacles=[
            # Lightning bolt shape
            (4, 0), (5, 0), (6, 0),
            (5, 1), (6, 1), (7, 1),
            (6, 2), (7, 2), (8, 2),
            (7, 3), (8, 3), (9, 3),
            (8, 4), (9, 4), (10, 4),
            # Middle fork
            (4, 5), (5, 5), (6, 5), (7, 5), (8, 5),
            (5, 6), (6, 6), (7, 6),
            (6, 7), (7, 7), (8, 7),
            (7, 8), (8, 8), (9, 8),
            # Bottom continuation
            (5, 10), (6, 10), (7, 10),
            (4, 11), (5, 11), (6, 11),
            (3, 12), (4, 12), (5, 12),
            (4, 13), (5, 13), (6, 13),
            (5, 14), (6, 14), (7, 14),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Tetris",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=14,
        laser_y=5,
        laser_dir=Direction.LEFT,
        obstacles=[
            # L-piece
            (1, 2), (1, 3), (1, 4), (2, 4),
            # T-piece
            (5, 2), (6, 2), (7, 2), (6, 3),
            # S-piece
            (11, 2), (12, 2), (10, 3), (11, 3),
            # Square piece
            (3, 8), (4, 8), (3, 9), (4, 9),
            # I-piece
            (8, 7), (8, 8), (8, 9), (8, 10),
            # Z-piece
            (11, 8), (12, 8), (12, 9), (13, 9),
            # J-piece
            (2, 14), (3, 14), (3, 15), (3, 16),
            # Another T-piece
            (7, 14), (8, 14), (9, 14), (8, 15),
            # Another L-piece
            (12, 14), (12, 15), (12, 16), (13, 16),
        ],
        num_mirrors=9,
    ),
    PuzzleConfig(
        name="Grid Lock",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=3,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Regular grid pattern with strategic gaps
            *[(3, i) for i in range(0, 20, 4)],
            *[(6, i + 2) for i in range(0, 18, 4)],
            *[(9, i) for i in range(0, 20, 4)],
            *[(12, i + 2) for i in range(0, 18, 4)],
            # Horizontal bars
            *[(i + 1, 7) for i in range(4)],
            *[(i + 8, 7) for i in range(4)],
            *[(i + 1, 13) for i in range(4)],
            *[(i + 8, 13) for i in range(4)],
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Snowflake",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=3,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Center
            (7, 10),
            # Six arms
            # Up
            (7, 7), (7, 8), (7, 9), (6, 8), (8, 8),
            # Down
            (7, 11), (7, 12), (7, 13), (6, 12), (8, 12),
            # Upper-left
            (4, 7), (5, 8), (6, 9), (4, 8), (5, 7),
            # Upper-right
            (10, 7), (9, 8), (8, 9), (10, 8), (9, 7),
            # Lower-left
            (4, 13), (5, 12), (6, 11), (4, 12), (5, 13),
            # Lower-right
            (10, 13), (9, 12), (8, 11), (10, 12), (9, 13),
            # Outer tips
            (7, 4), (7, 16), (1, 10), (13, 10),
        ],
        num_mirrors=11,
    ),
    PuzzleConfig(
        name="Temple",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=7,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # Temple roof (triangle)
            (7, 2),
            (6, 3), (8, 3),
            (5, 4), (9, 4),
            # Columns
            *[(4, i + 6) for i in range(10)],
            *[(6, i + 6) for i in range(10)],
            *[(8, i + 6) for i in range(10)],
            *[(10, i + 6) for i in range(10)],
            # Base
            *[(i + 3, 16) for i in range(9)],
            *[(i + 2, 18) for i in range(11)],
        ],
        num_mirrors=8,
    ),
    PuzzleConfig(
        name="Compass",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=0,
        laser_dir=Direction.DOWN,
        obstacles=[
            # North arrow
            (7, 1), (6, 2), (7, 2), (8, 2), (7, 3), (7, 4),
            # South arrow
            (7, 16), (7, 17), (6, 17), (7, 17), (8, 17), (7, 18),
            # East arrow
            (12, 10), (13, 10), (12, 9), (12, 11), (11, 10),
            # West arrow
            (2, 10), (3, 10), (2, 9), (2, 11), (4, 10),
            # Center compass rose
            (6, 9), (8, 9), (6, 11), (8, 11),
            # Decorative corners
            (1, 1), (13, 1), (1, 18), (13, 18),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Bookshelf",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=5,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Shelf backs (vertical sections with gaps)
            *[(0, i) for i in range(5)],
            *[(0, i + 8) for i in range(5)],
            *[(0, i + 16) for i in range(4)],
            # Horizontal shelves
            *[(i + 1, 3) for i in range(5)],
            *[(i + 8, 3) for i in range(5)],
            *[(i + 1, 9) for i in range(5)],
            *[(i + 8, 9) for i in range(5)],
            *[(i + 1, 15) for i in range(5)],
            *[(i + 8, 15) for i in range(5)],
            # Books (scattered obstacles)
            (3, 1), (4, 1), (10, 1), (12, 1),
            (2, 6), (5, 6), (9, 7), (11, 7),
            (3, 12), (6, 12), (10, 12), (13, 12),
            (2, 17), (5, 18), (9, 17), (12, 18),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Archipelago",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=5,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Island clusters of varying sizes
            # Large island
            (3, 3), (4, 3), (5, 3), (3, 4), (4, 4), (5, 4), (4, 5),
            # Medium island
            (10, 2), (11, 2), (10, 3), (11, 3), (12, 3),
            # Small islands
            (1, 10), (2, 10), (1, 11),
            (8, 8), (9, 8), (8, 9),
            (13, 9), (14, 9),
            # Southern chain
            (2, 15), (3, 15), (4, 15), (3, 16),
            (7, 14), (8, 14), (7, 15),
            (11, 16), (12, 16), (12, 17), (13, 17),
        ],
        num_mirrors=10,
    ),
    PuzzleConfig(
        name="Rocket",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=10,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Nose cone
            (7, 1),
            (6, 2), (8, 2),
            (5, 3), (9, 3),
            # Body
            *[(5, i + 4) for i in range(8)],
            *[(9, i + 4) for i in range(8)],
            # Fins
            (3, 12), (4, 13), (4, 14), (5, 14),
            (11, 12), (10, 13), (10, 14), (9, 14),
            # Exhaust
            (6, 15), (8, 15),
            (5, 16), (9, 16),
            (6, 17), (7, 17), (8, 17),
            (7, 18),
        ],
        num_mirrors=9,
    ),
    PuzzleConfig(
        name="Maze Classic",
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        laser_x=0,
        laser_y=1,
        laser_dir=Direction.RIGHT,
        obstacles=[
            # Classic maze pattern
            *[(i + 2, 0) for i in range(5)],
            *[(7, i) for i in range(5)],
            *[(i + 9, 2) for i in range(4)],
            (12, 3), (12, 4),
            *[(i, 5) for i in range(5)],
            *[(i + 6, 6) for i in range(5)],
            (10, 7), (10, 8),
            *[(i + 11, 8) for i in range(4)],
            *[(i + 2, 10) for i in range(6)],
            (2, 11), (2, 12),
            *[(i, 13) for i in range(4)],
            *[(i + 5, 12) for i in range(5)],
            (9, 13), (9, 14),
            *[(i + 10, 14) for i in range(4)],
            *[(i + 2, 16) for i in range(5)],
            *[(i + 8, 17) for i in range(4)],
            (7, 18), (7, 19),
        ],
        num_mirrors=11,
    ),
]

#!/usr/bin/env python3
"""
One-time migration script: generate solver/puzzles/*.json from the
puzzle configs that were hardcoded in puzzles.py.

Each JSON file preserves the original obstacle-group comments as
"label" fields inside obstacle_groups, and splitter design notes
as "note" on each splitter entry (or top-level "notes" for general remarks).

Run once:
    python make_puzzle_configs.py

After running, puzzles.py and puzzles.js are updated to load from
solver/puzzles/ instead of from hardcoded data.
"""

import json
from pathlib import Path

OUT_DIR = Path(__file__).parent / "puzzles"
OUT_DIR.mkdir(exist_ok=True)

W, H = 15, 20   # grid dimensions for all puzzles


def col(x, y, n):
    return [(x, y + i) for i in range(n)]


def row(x, y, n):
    return [(x + i, y) for i in range(n)]


def blk(x, y, w, h):
    return [(x + i, y + j) for i in range(w) for j in range(h)]


# ---------------------------------------------------------------------------
# Puzzle data: each entry mirrors the corresponding PuzzleConfig in puzzles.py
# with obstacle_groups taken directly from the inline comments.
# ---------------------------------------------------------------------------

PUZZLES = {
    # === Mar 3-6, 2026 (splitter showcase) ===
    "2026-03-03": {
        "name": "Crossfire",
        "laser": {"x": 0, "y": 10, "dir": "right"},
        "num_mirrors": 6,
        "obstacle_groups": [
            {
                "label": "Upper and lower mid-left barriers (channel the approach visually)",
                "cells": [(3,7),(4,7),(5,7), (3,13),(4,13),(5,13)],
            },
            {
                "label": "Upper and lower right-corner clusters",
                "cells": [(10,2),(11,2),(12,2), (10,17),(11,17),(12,17)],
            },
        ],
        "splitters": [
            {"x": 7, "y": 10, "dir": "right"},
        ],
    },

    "2026-03-04": {
        "name": "Chain Reaction",
        "laser": {"x": 0, "y": 10, "dir": "right"},
        "num_mirrors": 8,
        "obstacle_groups": [
            {
                "label": "Short walls above and below the laser approach",
                "cells": [(1,7),(2,7),(3,7), (1,13),(2,13),(3,13)],
            },
            {
                "label": "Top and bottom edge clusters",
                "cells": [(9,0),(10,0),(11,0), (9,19),(10,19),(11,19)],
            },
        ],
        "splitters": [
            {"x": 5, "y": 10, "dir": "right",
             "note": "rightward laser splits UP/DOWN"},
            {"x": 5, "y": 4,  "dir": "up",
             "note": "upward beam from splitter 1 splits LEFT/RIGHT"},
        ],
    },

    "2026-03-05": {
        "name": "Solar Flare",
        "laser": {"x": 0, "y": 10, "dir": "right"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {
                "label": "Corona arc (the sun's crown, above the splitter)",
                "cells": [(5,1),(6,1),(7,1),(8,1),(9,1),(10,1),
                           (5,2),(10,2), (5,3),(10,3)],
            },
            {
                "label": "Outer flare rays",
                "cells": [(3,0),(4,0), (11,0),(12,0),
                           (2,2),(3,2), (12,2),(13,2),
                           (1,5),(2,5), (12,5),(13,5)],
            },
            {
                "label": "Lower barriers",
                "cells": [(3,15),(4,15),(5,15), (9,15),(10,15),(11,15),
                           (1,18),(2,18),(3,18), (11,18),(12,18),(13,18)],
            },
        ],
        "splitters": [
            {"x": 8, "y": 4, "dir": "up"},
        ],
        "notes": [
            "Splitter is in upper area (row 4), NOT in the laser's initial row-10 path.",
            "Player must redirect the beam upward to reach it.",
        ],
    },

    # === Jan 22-28, 2026 ===
    "2026-01-22": {
        "name": "Chamber Grid",
        "laser": {"x": 0, "y": 8, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Vertical dividers (with gaps for passages)",
                "cells": (col(4,0,5) + col(4,7,4) + col(4,13,5) +
                          col(9,1,5) + col(9,8,4) + col(9,14,5)),
            },
            {
                "label": "Horizontal dividers (with gaps)",
                "cells": (row(1,5,3) + row(6,5,3) + row(11,5,3) +
                          row(1,12,3) + row(6,12,3) + row(11,12,3) +
                          row(1,17,3) + row(6,17,3) + row(11,17,3)),
            },
        ],
        "splitters": [],
    },

    "2026-01-23": {
        "name": "Diagonal Barriers",
        "laser": {"x": 0, "y": 19, "dir": "up"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Diagonal barrier 1 (bottom-left to middle)",
                "cells": [(2,17),(3,16),(4,15),(5,14),(6,13)],
            },
            {
                "label": "Diagonal barrier 2 (right side)",
                "cells": [(12,15),(11,14),(10,13),(9,12),(8,11)],
            },
            {
                "label": "Diagonal barrier 3",
                "cells": [(3,9),(4,8),(5,7),(6,6),(7,5)],
            },
            {
                "label": "Diagonal barrier 4",
                "cells": [(11,7),(10,6),(9,5),(8,4),(7,3)],
            },
            {
                "label": "Diagonal barrier 5 (top)",
                "cells": [(2,3),(3,2),(4,1),(5,0), (12,2),(13,1),(14,0)],
            },
            {
                "label": "Some blocking walls",
                "cells": [(0,10),(1,10), (13,10),(14,10)],
            },
        ],
        "splitters": [],
    },

    "2026-01-24": {
        "name": "Fortress",
        "laser": {"x": 7, "y": 0, "dir": "down"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Central fortress walls",
                "cells": [(5,8),(6,8),(7,8),(8,8),(9,8),
                           (5,9),(9,9), (5,10),(9,10),
                           (5,11),(6,11),(7,11),(8,11),(9,11)],
            },
            {
                "label": "Outer defense - top",
                "cells": [(3,4),(4,4),(5,4),(9,4),(10,4),(11,4)],
            },
            {
                "label": "Outer defense - bottom",
                "cells": [(3,15),(4,15),(5,15),(9,15),(10,15),(11,15)],
            },
            {
                "label": "Side towers",
                "cells": col(1,6,8) + col(13,6,8),
            },
            {
                "label": "Corner blocks",
                "cells": [(0,0),(1,0),(0,1),
                           (13,0),(14,0),(14,1),
                           (0,18),(0,19),(1,19),
                           (14,18),(14,19),(13,19)],
            },
        ],
        "splitters": [],
    },

    "2026-01-25": {
        "name": "Labyrinth",
        "laser": {"x": 0, "y": 1, "dir": "right"},
        "num_mirrors": 11,
        "obstacle_groups": [
            {
                "label": "Horizontal walls",
                "cells": (row(2,3,6) + row(10,3,5) +
                          row(0,6,5) + row(7,6,5) +
                          row(3,9,6) + row(11,9,4) +
                          row(0,12,4) + row(6,12,5) + row(13,12,2) +
                          row(2,15,5) + row(9,15,5) +
                          row(0,18,5) + row(7,18,3) + row(12,18,3)),
            },
        ],
        "splitters": [],
    },

    "2026-01-26": {
        "name": "Scattered Islands",
        "laser": {"x": 14, "y": 10, "dir": "left"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {"label": "Island 1 (top-left)",
             "cells": [(1,2),(2,2),(3,2),(2,3),(2,4)]},
            {"label": "Island 2 (top-right)",
             "cells": [(11,1),(12,1),(11,2),(12,2),(13,2)]},
            {"label": "Island 3 (middle-left)",
             "cells": [(0,8),(1,8),(2,8),(1,9),(0,10),(1,10)]},
            {"label": "Island 4 (center)",
             "cells": [(6,9),(7,9),(8,9),(6,10),(8,10),(6,11),(7,11),(8,11)]},
            {"label": "Island 5 (middle-right)",
             "cells": [(12,7),(13,7),(12,8),(13,8),(14,8)]},
            {"label": "Island 6 (bottom-left)",
             "cells": [(2,15),(3,15),(4,15),(3,16),(3,17),(4,17)]},
            {"label": "Island 7 (bottom-center)",
             "cells": [(8,16),(9,16),(10,16),(9,17)]},
            {"label": "Island 8 (bottom-right)",
             "cells": [(12,14),(13,14),(12,15),(13,15),(14,15)]},
        ],
        "splitters": [],
    },

    "2026-01-27": {
        "name": "Gauntlet",
        "laser": {"x": 0, "y": 0, "dir": "down"},
        "num_mirrors": 8,
        "obstacle_groups": [
            {
                "label": "Alternating horizontal barriers",
                "cells": (row(2,3,10) + row(3,7,10) +
                          row(2,11,10) + row(3,15,10)),
            },
            {
                "label": "Side barriers",
                "cells": (col(0,5,3) + col(14,9,3) +
                          col(0,13,3) + col(14,17,3)),
            },
        ],
        "splitters": [],
    },

    "2026-01-28": {
        "name": "Spiral Inward",
        "laser": {"x": 0, "y": 0, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Outer wall (top, leaving gap at right)",
                "cells": row(0,2,13),
            },
            {
                "label": "Right wall going down",
                "cells": col(13,2,15),
            },
            {
                "label": "Bottom wall going left",
                "cells": row(3,17,11),
            },
            {
                "label": "Left wall going up",
                "cells": col(3,5,13),
            },
            {
                "label": "Inner spiral",
                "cells": (row(3,5,8) + col(10,5,9) +
                          row(6,14,5) + col(6,8,7) + row(6,8,3)),
            },
        ],
        "splitters": [],
    },

    # === Jan 29 - Feb 28, 2026 ===
    "2026-01-29": {
        "name": "Cross Roads",
        "laser": {"x": 0, "y": 5, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Vertical cross arm",
                "cells": col(7,0,6) + col(7,14,6),
            },
            {
                "label": "Horizontal cross arm",
                "cells": row(0,10,5) + row(10,10,5),
            },
            {
                "label": "Corner blocks",
                "cells": [(2,2),(3,2),(2,3),
                           (11,2),(12,2),(12,3),
                           (2,17),(3,17),(2,16),
                           (11,17),(12,17),(12,16)],
            },
        ],
        "splitters": [],
    },

    "2026-01-30": {
        "name": "Zigzag Valley",
        "laser": {"x": 0, "y": 0, "dir": "right"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {
                "label": "Zigzag walls",
                "cells": (row(0,4,8) + row(7,8,8) +
                          row(0,12,8) + row(7,16,8)),
            },
            {
                "label": "Vertical connectors",
                "cells": [(7,5),(7,6),(7,7), (7,13),(7,14),(7,15)],
            },
        ],
        "splitters": [],
    },

    "2026-01-31": {
        "name": "Concentric Boxes",
        "laser": {"x": 14, "y": 0, "dir": "down"},
        "num_mirrors": 11,
        "obstacle_groups": [
            {
                "label": "Outer box (with gaps)",
                "cells": (row(1,2,6) + row(8,2,6) +
                          row(1,17,6) + row(8,17,6) +
                          col(1,3,6) + col(1,11,6) +
                          col(13,3,6) + col(13,11,6)),
            },
            {
                "label": "Inner box",
                "cells": (row(5,7,5) + row(5,12,5) +
                          col(5,8,4) + col(9,8,4)),
            },
        ],
        "splitters": [],
    },

    "2026-02-01": {
        "name": "Checkerboard",
        "laser": {"x": 0, "y": 12, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "2x2 blocks in checkerboard pattern",
                "cells": (blk(1,1,2,2) + blk(6,1,2,2) + blk(11,1,2,2) +
                          blk(3,5,2,2) + blk(8,5,2,2) +
                          blk(1,9,2,2) + blk(6,9,2,2) + blk(11,9,2,2) +
                          blk(3,13,2,2) + blk(8,13,2,2) +
                          blk(1,17,2,2) + blk(6,17,2,2) + blk(11,17,2,2)),
            },
        ],
        "splitters": [],
    },

    "2026-02-02": {
        "name": "Arrow",
        "laser": {"x": 7, "y": 19, "dir": "up"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {
                "label": "Arrow head pointing up",
                "cells": [(7,2),
                           (6,3),(8,3), (5,4),(9,4), (4,5),(10,5),
                           (3,6),(11,6), (2,7),(12,7)],
            },
            {
                "label": "Arrow shaft",
                "cells": col(6,8,8) + col(8,8,8),
            },
            {
                "label": "Feathers at bottom",
                "cells": [(4,16),(5,17),(4,18), (10,16),(9,17),(10,18)],
            },
        ],
        "splitters": [],
    },

    "2026-02-03": {
        "name": "Staircase",
        "laser": {"x": 0, "y": 19, "dir": "up"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Ascending stairs from bottom-left",
                "cells": (row(0,17,3) + row(2,14,3) + row(4,11,3) +
                          row(6,8,3) + row(8,5,3) + row(10,2,3)),
            },
            {
                "label": "Stair risers",
                "cells": [(2,15),(2,16), (4,12),(4,13),
                           (6,9),(6,10), (8,6),(8,7), (10,3),(10,4)],
            },
        ],
        "splitters": [],
    },

    "2026-02-04": {
        "name": "Window Frame",
        "laser": {"x": 0, "y": 3, "dir": "right"},
        "num_mirrors": 11,
        "obstacle_groups": [
            {
                "label": "Outer frame",
                "cells": (row(0,0,15) + row(0,19,15) +
                          col(0,1,18) + col(14,1,18)),
            },
            {
                "label": "Window panes (cross dividers)",
                "cells": (col(7,2,7) + col(7,12,7) +
                          row(2,10,5) + row(9,10,5)),
            },
        ],
        "splitters": [],
    },

    "2026-02-05": {
        "name": "Tunnel Run",
        "laser": {"x": 7, "y": 0, "dir": "down"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {
                "label": "Left tunnel wall",
                "cells": col(3,0,8) + col(3,12,8),
            },
            {
                "label": "Right tunnel wall",
                "cells": col(11,0,8) + col(11,12,8),
            },
            {
                "label": "Obstacles in tunnel",
                "cells": [(5,3),(9,3), (6,6),(8,6),
                           (7,9),(7,10), (6,13),(8,13), (5,16),(9,16)],
            },
        ],
        "splitters": [],
    },

    "2026-02-06": {
        "name": "Pinwheel",
        "laser": {"x": 0, "y": 10, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Center hub",
                "cells": [(6,9),(7,9),(8,9),
                           (6,10),(8,10),
                           (6,11),(7,11),(8,11)],
            },
            {
                "label": "Blades extending from center",
                "cells": (row(9,8,4) +   # Right blade
                          row(2,12,4) +   # Left blade
                          col(7,2,4) +    # Top blade
                          col(7,14,4)),   # Bottom blade
            },
            {
                "label": "Corner accents",
                "cells": [(1,1),(2,2), (12,1),(13,2),
                           (1,18),(2,17), (12,18),(13,17)],
            },
        ],
        "splitters": [],
    },

    "2026-02-07": {
        "name": "Wave Pattern",
        "laser": {"x": 0, "y": 0, "dir": "down"},
        "num_mirrors": 8,
        "obstacle_groups": [
            {
                "label": "Wave 1",
                "cells": [(1,2),(2,3),(3,4),(4,3),(5,2),
                           (6,3),(7,4),(8,3),(9,2),(10,3),(11,4),(12,3),(13,2)],
            },
            {
                "label": "Wave 2",
                "cells": [(1,9),(2,10),(3,11),(4,10),(5,9),
                           (6,10),(7,11),(8,10),(9,9),(10,10),(11,11),(12,10),(13,9)],
            },
            {
                "label": "Wave 3",
                "cells": [(1,16),(2,17),(3,18),(4,17),(5,16),
                           (6,17),(7,18),(8,17),(9,16),(10,17),(11,18),(12,17),(13,16)],
            },
        ],
        "splitters": [],
    },

    "2026-02-08": {
        "name": "Pillars",
        "laser": {"x": 14, "y": 19, "dir": "left"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Scattered pillars (2x2 blocks)",
                "cells": (blk(2,2,2,2) + blk(8,3,2,2) + blk(12,1,2,2) +
                          blk(4,8,2,2) + blk(10,9,2,2) +
                          blk(1,14,2,2) + blk(6,15,2,2) + blk(11,16,2,2)),
            },
        ],
        "splitters": [],
    },

    "2026-02-09": {
        "name": "T-Junction",
        "laser": {"x": 0, "y": 15, "dir": "right"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {
                "label": "Main T shape",
                "cells": row(2,5,11) + col(7,6,10),  # Top of T + Stem of T
            },
            {
                "label": "Additional T shapes",
                "cells": (row(3,1,4) + col(5,2,3) +
                          row(9,1,4) + col(11,2,3)),
            },
            {
                "label": "Bottom T",
                "cells": row(2,17,11) + col(7,18,2),
            },
        ],
        "splitters": [],
    },

    "2026-02-10": {
        "name": "Serpentine",
        "laser": {"x": 7, "y": 0, "dir": "down"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "S-curve walls",
                "cells": (row(2,3,6) + col(7,4,3) +
                          row(7,7,6) + col(7,8,3) +
                          row(2,11,6) + col(7,12,3) +
                          row(7,15,6)),
            },
        ],
        "splitters": [],
    },

    "2026-02-11": {
        "name": "Diamond",
        "laser": {"x": 7, "y": 0, "dir": "down"},
        "num_mirrors": 11,
        "obstacle_groups": [
            {
                "label": "Diamond outline",
                "cells": [(7,2),
                           (6,3),(8,3), (5,4),(9,4), (4,5),(10,5),
                           (3,6),(11,6), (2,7),(12,7),
                           (1,8),(13,8), (1,9),(13,9), (1,10),(13,10), (1,11),(13,11),
                           (2,12),(12,12), (3,13),(11,13), (4,14),(10,14),
                           (5,15),(9,15), (6,16),(8,16), (7,17)],
            },
        ],
        "splitters": [],
    },

    "2026-02-12": {
        "name": "Bridge",
        "laser": {"x": 0, "y": 5, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "River (horizontal gap area markers)",
                "cells": (row(0,9,4) + row(11,9,4) +
                          row(0,11,4) + row(11,11,4)),
            },
            {
                "label": "Bridge pillars",
                "cells": [(5,8),(5,12), (9,8),(9,12)],
            },
            {
                "label": "Banks",
                "cells": (row(1,6,5) + row(9,6,5) +
                          row(1,14,5) + row(9,14,5)),
            },
            {
                "label": "Approach paths",
                "cells": [(2,2),(3,2),(4,2), (10,2),(11,2),(12,2),
                           (2,17),(3,17),(4,17), (10,17),(11,17),(12,17)],
            },
        ],
        "splitters": [],
    },

    "2026-02-13": {
        "name": "Maze Runner",
        "laser": {"x": 0, "y": 1, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Complex maze walls",
                "cells": (row(2,2,4) +
                          col(5,3,3) + row(5,5,4) +
                          col(8,6,2) + row(8,7,5) +
                          row(1,9,5) + col(1,10,2) + row(1,11,4) +
                          col(4,12,3) + row(4,14,6) +
                          col(9,15,2) + row(9,16,4) +
                          row(1,17,4)),
            },
        ],
        "splitters": [],
    },

    "2026-02-14": {
        "name": "Honeycomb",
        "laser": {"x": 14, "y": 10, "dir": "left"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {"label": "Cell 1",
             "cells": [(2,1),(3,1),(1,2),(4,2),(1,3),(4,3),(2,4),(3,4)]},
            {"label": "Cell 2",
             "cells": [(7,1),(8,1),(6,2),(9,2),(6,3),(9,3),(7,4),(8,4)]},
            {"label": "Cell 3",
             "cells": [(12,1),(13,1),(11,2),(14,2),(11,3),(14,3),(12,4),(13,4)]},
            {"label": "Cell 4",
             "cells": [(4,7),(5,7),(3,8),(6,8),(3,9),(6,9),(4,10),(5,10)]},
            {"label": "Cell 5",
             "cells": [(9,7),(10,7),(8,8),(11,8),(8,9),(11,9),(9,10),(10,10)]},
            {"label": "Cell 6",
             "cells": [(2,13),(3,13),(1,14),(4,14),(1,15),(4,15),(2,16),(3,16)]},
            {"label": "Cell 7",
             "cells": [(12,13),(13,13),(11,14),(14,14),(11,15),(14,15),(12,16),(13,16)]},
        ],
        "splitters": [],
    },

    "2026-02-15": {
        "name": "Hourglass",
        "laser": {"x": 0, "y": 10, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Top triangle (narrower, with gap at center)",
                "cells": (row(2,2,5) + row(8,2,5) +
                          row(3,4,4) + row(8,4,4) +
                          row(4,6,3) + row(8,6,3) +
                          row(5,8,2) + row(8,8,2)),
            },
            {
                "label": "Bottom triangle (inverted)",
                "cells": (row(5,12,2) + row(8,12,2) +
                          row(4,14,3) + row(8,14,3) +
                          row(3,16,4) + row(8,16,4) +
                          row(2,18,5) + row(8,18,5)),
            },
        ],
        "splitters": [],
    },

    "2026-02-16": {
        "name": "Castle",
        "laser": {"x": 0, "y": 15, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Castle towers (top)",
                "cells": [(1,1),(2,1),(1,2),(2,2),
                           (6,1),(7,1),(8,1),(6,2),(8,2),
                           (12,1),(13,1),(12,2),(13,2)],
            },
            {
                "label": "Battlements",
                "cells": row(1,4,13),
            },
            {
                "label": "Castle walls",
                "cells": col(1,5,10) + col(13,5,10),
            },
            {
                "label": "Inner courtyard walls",
                "cells": [(4,7),(4,8),(4,9),
                           (10,7),(10,8),(10,9),
                           *row(5,10,5)],
            },
            {
                "label": "Gate",
                "cells": [(6,14),(8,14), *row(5,15,5)],
            },
        ],
        "splitters": [],
    },

    "2026-02-17": {
        "name": "Vortex",
        "laser": {"x": 0, "y": 0, "dir": "right"},
        "num_mirrors": 11,
        "obstacle_groups": [
            {
                "label": "Arm 1 (top-right)",
                "cells": [(8,8),(9,7),(10,6),(11,5),(12,4),(13,3)],
            },
            {
                "label": "Arm 2 (bottom-right)",
                "cells": [(8,11),(9,12),(10,13),(11,14),(12,15),(13,16)],
            },
            {
                "label": "Arm 3 (bottom-left)",
                "cells": [(6,11),(5,12),(4,13),(3,14),(2,15),(1,16)],
            },
            {
                "label": "Arm 4 (top-left)",
                "cells": [(6,8),(5,7),(4,6),(3,5),(2,4),(1,3)],
            },
            {
                "label": "Center",
                "cells": [(7,9),(7,10)],
            },
        ],
        "splitters": [],
    },

    "2026-02-18": {
        "name": "Railroad",
        "laser": {"x": 0, "y": 3, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Track rails (with gaps for crossing)",
                "cells": (row(0,8,6) + row(9,8,6) +
                          row(0,12,6) + row(9,12,6)),
            },
            {
                "label": "Cross ties",
                "cells": [(2,9),(2,11), (4,9),(4,11),
                           (10,9),(10,11), (12,9),(12,11)],
            },
            {
                "label": "Station platforms",
                "cells": row(4,2,3) + row(4,4,3) + row(8,15,3) + row(8,17,3),
            },
            {
                "label": "Waiting areas",
                "cells": [(1,6),(2,6), (12,6),(13,6),
                           (1,14),(2,14), (12,14),(13,14)],
            },
        ],
        "splitters": [],
    },

    "2026-02-19": {
        "name": "Lightning",
        "laser": {"x": 7, "y": 19, "dir": "up"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Lightning bolt shape",
                "cells": [(4,0),(5,0),(6,0),
                           (5,1),(6,1),(7,1),
                           (6,2),(7,2),(8,2),
                           (7,3),(8,3),(9,3),
                           (8,4),(9,4),(10,4)],
            },
            {
                "label": "Middle fork",
                "cells": [(4,5),(5,5),(6,5),(7,5),(8,5),
                           (5,6),(6,6),(7,6),
                           (6,7),(7,7),(8,7),
                           (7,8),(8,8),(9,8)],
            },
            {
                "label": "Bottom continuation",
                "cells": [(5,10),(6,10),(7,10),
                           (4,11),(5,11),(6,11),
                           (3,12),(4,12),(5,12),
                           (4,13),(5,13),(6,13),
                           (5,14),(6,14),(7,14)],
            },
        ],
        "splitters": [],
    },

    "2026-02-20": {
        "name": "Tetris",
        "laser": {"x": 14, "y": 5, "dir": "left"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {"label": "L-piece",           "cells": [(1,2),(1,3),(1,4),(2,4)]},
            {"label": "T-piece",           "cells": [(5,2),(6,2),(7,2),(6,3)]},
            {"label": "S-piece",           "cells": [(11,2),(12,2),(10,3),(11,3)]},
            {"label": "Square piece",      "cells": [(3,8),(4,8),(3,9),(4,9)]},
            {"label": "I-piece",           "cells": [(8,7),(8,8),(8,9),(8,10)]},
            {"label": "Z-piece",           "cells": [(11,8),(12,8),(12,9),(13,9)]},
            {"label": "J-piece",           "cells": [(2,14),(3,14),(3,15),(3,16)]},
            {"label": "Another T-piece",   "cells": [(7,14),(8,14),(9,14),(8,15)]},
            {"label": "Another L-piece",   "cells": [(12,14),(12,15),(12,16),(13,16)]},
        ],
        "splitters": [],
    },

    "2026-02-21": {
        "name": "Grid Lock",
        "laser": {"x": 0, "y": 3, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Regular grid pattern with strategic gaps",
                "cells": ([(3, i) for i in range(0, 20, 4)] +
                          [(6, i + 2) for i in range(0, 18, 4)] +
                          [(9, i) for i in range(0, 20, 4)] +
                          [(12, i + 2) for i in range(0, 18, 4)]),
            },
            {
                "label": "Horizontal bars",
                "cells": (row(1,7,4) + row(8,7,4) +
                          row(1,13,4) + row(8,13,4)),
            },
        ],
        "splitters": [],
    },

    "2026-02-22": {
        "name": "Snowflake",
        "laser": {"x": 0, "y": 3, "dir": "right"},
        "num_mirrors": 11,
        "obstacle_groups": [
            {"label": "Center",       "cells": [(7,10)]},
            {"label": "Up arm",       "cells": [(7,7),(7,8),(7,9),(6,8),(8,8)]},
            {"label": "Down arm",     "cells": [(7,11),(7,12),(7,13),(6,12),(8,12)]},
            {"label": "Upper-left",   "cells": [(4,7),(5,8),(6,9),(4,8),(5,7)]},
            {"label": "Upper-right",  "cells": [(10,7),(9,8),(8,9),(10,8),(9,7)]},
            {"label": "Lower-left",   "cells": [(4,13),(5,12),(6,11),(4,12),(5,13)]},
            {"label": "Lower-right",  "cells": [(10,13),(9,12),(8,11),(10,12),(9,13)]},
            {"label": "Outer tips",   "cells": [(7,4),(7,16),(1,10),(13,10)]},
        ],
        "splitters": [],
    },

    "2026-02-23": {
        "name": "Temple",
        "laser": {"x": 7, "y": 0, "dir": "down"},
        "num_mirrors": 8,
        "obstacle_groups": [
            {
                "label": "Temple roof (triangle)",
                "cells": [(7,2), (6,3),(8,3), (5,4),(9,4)],
            },
            {
                "label": "Columns",
                "cells": col(4,6,10) + col(6,6,10) + col(8,6,10) + col(10,6,10),
            },
            {
                "label": "Base",
                "cells": row(3,16,9) + row(2,18,11),
            },
        ],
        "splitters": [],
    },

    "2026-02-24": {
        "name": "Compass",
        "laser": {"x": 0, "y": 0, "dir": "down"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "North arrow",
                "cells": [(7,1),(6,2),(7,2),(8,2),(7,3),(7,4)],
            },
            {
                "label": "South arrow",
                "cells": [(7,16),(7,17),(6,17),(7,17),(8,17),(7,18)],
            },
            {
                "label": "East arrow",
                "cells": [(12,10),(13,10),(12,9),(12,11),(11,10)],
            },
            {
                "label": "West arrow",
                "cells": [(2,10),(3,10),(2,9),(2,11),(4,10)],
            },
            {
                "label": "Center compass rose",
                "cells": [(6,9),(8,9),(6,11),(8,11)],
            },
            {
                "label": "Decorative corners",
                "cells": [(1,1),(13,1),(1,18),(13,18)],
            },
        ],
        "splitters": [],
    },

    "2026-02-25": {
        "name": "Bookshelf",
        "laser": {"x": 0, "y": 5, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Shelf backs (vertical sections with gaps)",
                "cells": col(0,0,5) + col(0,8,5) + col(0,16,4),
            },
            {
                "label": "Horizontal shelves",
                "cells": (row(1,3,5) + row(8,3,5) +
                          row(1,9,5) + row(8,9,5) +
                          row(1,15,5) + row(8,15,5)),
            },
            {
                "label": "Books (scattered obstacles)",
                "cells": [(3,1),(4,1),(10,1),(12,1),
                           (2,6),(5,6),(9,7),(11,7),
                           (3,12),(6,12),(10,12),(13,12),
                           (2,17),(5,18),(9,17),(12,18)],
            },
        ],
        "splitters": [],
    },

    "2026-02-26": {
        "name": "Archipelago",
        "laser": {"x": 0, "y": 5, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Large island",
                "cells": [(3,3),(4,3),(5,3),(3,4),(4,4),(5,4),(4,5)],
            },
            {
                "label": "Medium island",
                "cells": [(10,2),(11,2),(10,3),(11,3),(12,3)],
            },
            {
                "label": "Small islands",
                "cells": [(1,10),(2,10),(1,11),
                           (8,8),(9,8),(8,9),
                           (13,9),(14,9)],
            },
            {
                "label": "Southern chain",
                "cells": [(2,15),(3,15),(4,15),(3,16),
                           (7,14),(8,14),(7,15),
                           (11,16),(12,16),(12,17),(13,17)],
            },
        ],
        "splitters": [],
    },

    "2026-02-27": {
        "name": "Rocket",
        "laser": {"x": 0, "y": 10, "dir": "right"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {
                "label": "Nose cone",
                "cells": [(7,1), (6,2),(8,2), (5,3),(9,3)],
            },
            {
                "label": "Body",
                "cells": col(5,4,8) + col(9,4,8),
            },
            {
                "label": "Fins",
                "cells": [(3,12),(4,13),(4,14),(5,14),
                           (11,12),(10,13),(10,14),(9,14)],
            },
            {
                "label": "Exhaust",
                "cells": [(6,15),(8,15), (5,16),(9,16),
                           (6,17),(7,17),(8,17), (7,18)],
            },
        ],
        "splitters": [],
    },

    "2026-02-28": {
        "name": "Maze Classic",
        "laser": {"x": 0, "y": 1, "dir": "right"},
        "num_mirrors": 11,
        "obstacle_groups": [
            {
                "label": "Classic maze pattern",
                "cells": (row(2,0,5) + col(7,0,5) + row(9,2,4) +
                          col(12,3,2) +
                          row(0,5,5) + row(6,6,5) +
                          col(10,7,2) + row(11,8,4) +
                          row(2,10,6) + col(2,11,2) +
                          row(0,13,4) + row(5,12,5) +
                          col(9,13,2) + row(10,14,4) +
                          row(2,16,5) + row(8,17,4) +
                          col(7,18,2)),
            },
        ],
        "splitters": [],
    },

    # === Mar 1+, 2026 ===
    "2026-03-01": {
        "name": "River Bend",
        "laser": {"x": 0, "y": 0, "dir": "right"},
        "num_mirrors": 10,
        "obstacle_groups": [
            {
                "label": "Upper river bank (curved)",
                "cells": [(2,4),(3,4),(4,5),(5,5),(6,6),(7,6),
                           (8,6),(9,5),(10,5),(11,4),(12,4)],
            },
            {
                "label": "Lower river bank (curved, offset)",
                "cells": [(1,8),(2,8),(3,9),(4,9),(5,10),(6,10),
                           (7,10),(8,10),(9,9),(10,9),(11,8),(12,8),(13,8)],
            },
            {
                "label": "Second bend - upper bank",
                "cells": [(2,13),(3,13),(4,12),(5,12),(6,12),
                           (7,13),(8,13),(9,14),(10,14),(11,14)],
            },
            {
                "label": "Second bend - lower bank",
                "cells": [(1,16),(2,17),(3,17),(4,16),(5,16),
                           (6,16),(7,17),(8,17),(9,18),(10,18),(11,17),(12,17)],
            },
        ],
        "splitters": [],
    },

    "2026-03-02": {
        "name": "Scattered Stones",
        "laser": {"x": 7, "y": 0, "dir": "down"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {
                "label": "Top region",
                "cells": [(2,2),(3,3), (8,1),(9,2), (12,3),(13,2)],
            },
            {
                "label": "Upper-middle region",
                "cells": [(1,6),(2,7), (5,5),(6,6), (10,7),(11,6), (14,5)],
            },
            {
                "label": "Center region",
                "cells": [(0,10),(1,11), (4,9),(5,10),(4,11),
                           (8,10),(9,9),(9,11), (12,10),(13,11)],
            },
            {
                "label": "Lower-middle region",
                "cells": [(2,14),(3,13), (6,14),(7,15),
                           (10,13),(11,14), (14,14)],
            },
            {
                "label": "Bottom region",
                "cells": [(1,17),(2,18), (5,17),(6,18),
                           (9,17),(10,18), (12,17),(13,17)],
            },
        ],
        "splitters": [],
    },

    "2026-03-06": {
        "name": "Slingshot",
        "laser": {"x": 7, "y": 0, "dir": "down"},
        "num_mirrors": 9,
        "obstacle_groups": [
            {
                "label": "Symmetric flanking wings",
                "cells": [(3,4),(4,4),(5,4), (9,4),(10,4),(11,4),
                           (3,15),(4,15),(5,15), (9,15),(10,15),(11,15)],
            },
            {
                "label": "Corner accent clusters",
                "cells": [(1,2),(2,2),(1,3),
                           (12,2),(13,2),(13,3),
                           (1,16),(1,17),(2,17),
                           (12,17),(13,17),(13,16)],
            },
        ],
        "splitters": [
            {"x": 7, "y": 10, "dir": "right",
             "note": "Laser goes DOWN, hitting the 'right' splitter from above → reflects LEFT (side hit). "
                     "To split (UP+DOWN), player must redirect the beam to arrive going RIGHT."},
        ],
    },
}


def make_json(date: str, data: dict) -> dict:
    return {
        "date": date,
        "name": data["name"],
        "width": W,
        "height": H,
        "laser": data["laser"],
        "num_mirrors": data["num_mirrors"],
        "obstacle_groups": [
            {"label": g["label"], "cells": [list(c) for c in g["cells"]]}
            for g in data["obstacle_groups"]
        ],
        "splitters": data.get("splitters", []),
        **({"notes": data["notes"]} if "notes" in data else {}),
    }


if __name__ == "__main__":
    for date, data in sorted(PUZZLES.items()):
        out = make_json(date, data)
        path = OUT_DIR / f"{date}.json"
        path.write_text(json.dumps(out, indent=2))
        n_cells = sum(len(g["cells"]) for g in out["obstacle_groups"])
        print(f"  {date}  {data['name']:<22}  {n_cells} obstacle cells")
    print(f"\nWrote {len(PUZZLES)} files to {OUT_DIR}/")

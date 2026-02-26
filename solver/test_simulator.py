"""
Unit tests for simulator.py — verify that Python path-length computation
matches the JavaScript Laser.ts calculateLaserPath behaviour.

Each test documents the expected JS output and asserts the Python result is
identical.  Run with:

    cd solver && python -m pytest test_simulator.py -v
"""

import pytest
from puzzles import Direction, PuzzleConfig
from simulator import simulate_laser, resolve_collisions


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def cfg(
    width: int,
    height: int,
    lx: int,
    ly: int,
    ld: str,
    obstacles: list | None = None,
    splitters: list | None = None,
    num_mirrors: int = 0,
) -> PuzzleConfig:
    """Build a minimal PuzzleConfig for testing."""
    return PuzzleConfig(
        name="test",
        width=width,
        height=height,
        laser_x=lx,
        laser_y=ly,
        laser_dir=Direction.from_string(ld),
        obstacles=obstacles or [],
        num_mirrors=num_mirrors,
        splitters=splitters or [],
    )


def length(config: PuzzleConfig, mirrors: list | None = None) -> int:
    return simulate_laser(config, mirrors or [])['length']


# ---------------------------------------------------------------------------
# Basic beam behaviour (no splitters)
# ---------------------------------------------------------------------------

class TestStraightLaser:
    """Laser travels straight across the grid and exits."""

    def test_horizontal_exits_right(self):
        # 10-wide grid, laser at x=0 going right.
        # Steps: (0,5)→(1,5) … (9,5)→(10,5) [out of bounds] = 10 segments.
        c = cfg(10, 10, 0, 5, 'right')
        assert length(c) == 10

    def test_vertical_exits_top(self):
        # 10-tall grid, laser at y=9 going up.
        # Steps: y=9→8→…→0→-1 = 10 segments.
        c = cfg(10, 10, 5, 9, 'up')
        assert length(c) == 10

    def test_laser_at_edge_exits_immediately(self):
        # Laser at the last column going right exits in 1 step.
        c = cfg(5, 5, 4, 2, 'right')
        assert length(c) == 1


class TestObstacleStop:
    """Laser is blocked by a wall obstacle."""

    def test_obstacle_ahead(self):
        # Laser at (0,5) going right; wall at (5,5).
        # Steps: (0→1),(1→2),(2→3),(3→4),(4→5) = 5 (the step onto the wall is counted).
        c = cfg(10, 10, 0, 5, 'right', obstacles=[(5, 5)])
        assert length(c) == 5

    def test_obstacle_adjacent(self):
        # Wall is immediately in front — 1 step.
        c = cfg(10, 10, 0, 5, 'right', obstacles=[(1, 5)])
        assert length(c) == 1

    def test_termination_reason_obstacle(self):
        c = cfg(10, 10, 0, 5, 'right', obstacles=[(3, 5)])
        result = simulate_laser(c, [])
        assert result['termination_reason'] == 'obstacle'


class TestMirrorReflection:
    """Laser reflects off '/' and '\\' mirrors."""

    def test_slash_right_to_up(self):
        # '/' mirror at (4,5): incoming RIGHT → exits UP.
        # 4 steps going right, then (4,4)→(4,3)→…→(4,-1) = 6 steps up. Total = 10.
        c = cfg(10, 10, 0, 5, 'right')
        assert length(c, [(4, 5, '/')]) == 10

    def test_backslash_right_to_down(self):
        # '\\' mirror at (4,5): incoming RIGHT → exits DOWN.
        # 4 steps right, then (4,6)→…→(4,10) = 5 steps down. Total = 9.
        c = cfg(10, 10, 0, 5, 'right')
        assert length(c, [(4, 5, '\\')]) == 9

    def test_slash_up_to_right(self):
        # '/' mirror at (3,7): incoming UP → exits RIGHT.
        # Laser at (3,9) going up: 2 steps to reach mirror, then goes right.
        # (3,9)→(3,8)→(3,7)[mirror, UP→RIGHT] then (4,7)→…→(9,7)→(10,7) = 2 + 7 = 9.
        c = cfg(10, 10, 3, 9, 'up')
        assert length(c, [(3, 7, '/')]) == 9

    def test_loop_detection(self):
        # Four mirrors form a clockwise rectangle; laser enters from the mid-point
        # of the top edge at (3,3) going right.  After completing one full circuit
        # the beam returns to (3,3) still travelling right — a state already in the
        # visited set → terminates as 'loop'.
        #
        # '\\' at (5,3): right→down  (top-right corner)
        # '/'  at (5,6): down→left   (bottom-right corner)
        # '\\' at (2,6): left→up     (bottom-left corner)
        # '/'  at (2,3): up→right    (top-left corner)
        c = cfg(8, 8, 3, 3, 'right')
        result = simulate_laser(c, [(5, 3, '\\'), (5, 6, '/'), (2, 6, '\\'), (2, 3, '/')])
        assert result['termination_reason'] == 'loop'


# ---------------------------------------------------------------------------
# Splitter behaviour (no collisions)
# ---------------------------------------------------------------------------

class TestSplitterActions:
    """Splitter wall, reflect, and split actions."""

    def test_splitter_wall(self):
        # Splitter at (5,5) with orientation='left'.
        # Laser going RIGHT hits the hypotenuse (opposite of 'left' = 'right') → wall.
        # 5 steps to reach the splitter (counted); then blocked.
        c = cfg(10, 10, 0, 5, 'right', splitters=[(5, 5, 'left')])
        result = simulate_laser(c, [])
        assert result['length'] == 5
        assert result['termination_reason'] == 'obstacle'

    def test_splitter_reflect_down(self):
        # Splitter at (5,5) with orientation='up'.
        # RIGHT is perpendicular to UP → reflects toward opposite('up') = DOWN.
        # 5 steps right to splitter, then 5 steps down to exit (grid 10x10, y=5 going down).
        # Down: (5,6)→(5,7)→(5,8)→(5,9)→(5,10) = 5 steps. Total = 10.
        c = cfg(10, 10, 0, 5, 'right', splitters=[(5, 5, 'up')])
        assert length(c) == 10

    def test_splitter_split_counts_both_beams(self):
        # Splitter at (5,7) orientation='right' in a 15x15 grid.
        # Laser at (0,7) going right: 5 steps to splitter (sub_offset=5).
        # UP beam from (5,7): 8 steps to exit (y=7→6→…→0→-1).
        # DOWN beam from (5,7): 8 steps to exit (y=7→8→…→14→15).
        # No collisions (beams go straight up/down on the same column but
        # diverge immediately and never share a cell at the same global time).
        # Total = 5 + 8 + 8 = 21.
        c = cfg(15, 15, 0, 7, 'right', splitters=[(5, 7, 'right')])
        assert length(c) == 21

    def test_splitter_split_both_beams_symmetric(self):
        # Splitter at (7,4) orientation='down' in a 15x10 grid.
        # Laser at (7,0) going down: 4 steps (sub_offset=4).
        # LEFT beam: 8 steps to exit (x=7→6→…→0→-1).
        # RIGHT beam: 8 steps to exit (x=7→8→…→14→15).
        # Total = 4 + 8 + 8 = 20.
        c = cfg(15, 10, 7, 0, 'down', splitters=[(7, 4, 'down')])
        assert length(c) == 20


# ---------------------------------------------------------------------------
# Splitter with head-on collision (the key new behaviour)
# ---------------------------------------------------------------------------

class TestCollisionDetection:
    """
    Verify that head-on beam collisions are detected and streams are truncated.

    Reference scenario (same-cell collision):

        Grid: 13 wide × 13 tall
        Laser at (0,6) going RIGHT
        Splitter at (6,6) orientation='right'  →  UP and DOWN sub-beams

        Mirrors:
          '/'  at (6,3)  : UP   beam → RIGHT
          '\\' at (10,3) : RIGHT beam → DOWN
          '\\' at (6,9)  : DOWN  beam → RIGHT
          '/'  at (10,9) : RIGHT beam → UP

        Both sub-beams converge at (10,6) at global time 16 from opposite
        directions (DOWN from the UP-branch, UP from the DOWN-branch).

        Stream lengths after collision truncation:
          Primary  : 6 segments  (laser → splitter)
          UP-branch: 10 segments (splitter → (10,6) inclusive)
          DN-branch: 10 segments (splitter → (10,6) inclusive)
          Total    : 26

        Without collision detection the beams would loop through the mirror
        circuit, yielding a much larger count (53 in CPython DFS order).
    """

    COLLISION_MIRRORS = [
        (6, 3, '/'),    # UP beam: UP → RIGHT
        (10, 3, '\\'),  # RIGHT beam: RIGHT → DOWN
        (6, 9, '\\'),   # DOWN beam: DOWN → RIGHT
        (10, 9, '/'),   # RIGHT beam: RIGHT → UP
    ]

    def _collision_config(self):
        return cfg(
            13, 13, 0, 6, 'right',
            splitters=[(6, 6, 'right')],
        )

    def test_collision_total_length(self):
        c = self._collision_config()
        assert length(c, self.COLLISION_MIRRORS) == 26

    def test_no_mirrors_no_collision(self):
        # Without mirrors the UP/DOWN beams go straight — they never share a
        # cell at the same global time, so no collision.
        # Primary: 6, UP: 7 (y 6→5→…→0→-1), DOWN: 7 (y 6→7→…→12→13). Total = 20.
        c = self._collision_config()
        assert length(c) == 20

    def test_partial_mirrors_no_collision(self):
        # Only the '/' mirror at (6,3) — UP beam turns right but DOWN beam
        # keeps going down.  They never meet.
        # Primary: 6 steps (to splitter)
        # UP-branch: 3 up to mirror + 7 right to exit = 10
        # DOWN-branch: 7 down to exit = 7
        # Total = 23
        c = self._collision_config()
        assert length(c, [(6, 3, '/')]) == 23


class TestResolveCollisionsDirect:
    """Unit tests for the resolve_collisions helper directly."""

    def test_no_collision_streams_on_different_rows(self):
        # Two streams going in the same direction on different rows — they never
        # share a cell, so no collision regardless of the new direction-agnostic rule.
        streams = [
            [(1, 0, Direction.RIGHT), (2, 0, Direction.RIGHT)],
            [(1, 1, Direction.RIGHT), (2, 1, Direction.RIGHT)],
        ]
        offsets = [0, 0]
        positions = resolve_collisions(streams, offsets)
        assert positions == []
        assert len(streams[0]) == 2
        assert len(streams[1]) == 2

    def test_same_direction_same_cell_is_collision(self):
        # Two streams going RIGHT along the same row share every cell simultaneously.
        # First shared cell is (1,0) at gTime=1; both truncated to 1 step.
        streams = [
            [(1, 0, Direction.RIGHT), (2, 0, Direction.RIGHT)],
            [(1, 0, Direction.RIGHT), (2, 0, Direction.RIGHT)],
        ]
        offsets = [0, 0]
        positions = resolve_collisions(streams, offsets)
        assert (1, 0) in positions
        assert len(streams[0]) == 1
        assert len(streams[1]) == 1

    def test_same_cell_same_time_truncates(self):
        # Stream 0 arrives at (5,3) going RIGHT at gTime=3 (offset=0, segi=2).
        # Stream 1 arrives at (5,3) going LEFT at gTime=3 (offset=0, segi=2).
        # Expected: both truncated to 3 steps (segi 0,1,2).
        streams = [
            [(3, 3, Direction.RIGHT), (4, 3, Direction.RIGHT), (5, 3, Direction.RIGHT)],
            [(7, 3, Direction.LEFT),  (6, 3, Direction.LEFT),  (5, 3, Direction.LEFT)],
        ]
        offsets = [0, 0]
        positions = resolve_collisions(streams, offsets)
        assert (5, 3) in positions
        assert len(streams[0]) == 3  # truncated to segi=2 → keeps 3 steps
        assert len(streams[1]) == 3

    def test_cell_at_mirror_is_collision(self):
        # Previously mirror cells were excluded; now any same-cell same-time pair
        # collides regardless of cell content.
        streams = [
            [(5, 3, Direction.RIGHT)],
            [(5, 3, Direction.LEFT)],
        ]
        offsets = [0, 0]
        positions = resolve_collisions(streams, offsets)
        assert (5, 3) in positions
        assert len(streams[0]) == 1
        assert len(streams[1]) == 1

    def test_perpendicular_same_cell_is_collision(self):
        # Stream 0 arrives at (5,3) going RIGHT at gTime=3.
        # Stream 1 arrives at (5,3) going DOWN at gTime=3.
        # Perpendicular, not head-on — but same cell same time → collision.
        streams = [
            [(3, 3, Direction.RIGHT), (4, 3, Direction.RIGHT), (5, 3, Direction.RIGHT)],
            [(5, 1, Direction.DOWN),  (5, 2, Direction.DOWN),  (5, 3, Direction.DOWN)],
        ]
        offsets = [0, 0]
        positions = resolve_collisions(streams, offsets)
        assert (5, 3) in positions
        assert len(streams[0]) == 3
        assert len(streams[1]) == 3

    def test_crossing_truncates(self):
        # Stream 0 arrives at (4,3) going RIGHT at gTime=1 (offset=0, segi=0).
        # Stream 1 arrives at (5,3) going LEFT at gTime=1 (offset=0, segi=0).
        # delta(RIGHT)=(1,0); b.pos=(5,3)=a.pos+(1,0) and b.dir=LEFT=opposite(RIGHT).
        # Crossing collision at midpoint (4.5, 3.0).
        streams = [
            [(4, 3, Direction.RIGHT)],
            [(5, 3, Direction.LEFT)],
        ]
        offsets = [0, 0]
        positions = resolve_collisions(streams, offsets)
        assert (4.5, 3.0) in positions
        assert len(streams[0]) == 1
        assert len(streams[1]) == 1

    def test_earliest_collision_kept_per_pair(self):
        # Two collisions for the same stream pair: at gTime=2 and gTime=4.
        # Only the earliest (gTime=2) should be used for truncation.
        # Stream 0: RIGHT at x=1,2,3,4,5 on y=0 (offsets=0 so gTimes 1–5)
        # Stream 1: LEFT  at x=5,4,3,2,1 on y=0 (gTimes 1–5)
        streams = [
            [(1,0,Direction.RIGHT),(2,0,Direction.RIGHT),(3,0,Direction.RIGHT),(4,0,Direction.RIGHT),(5,0,Direction.RIGHT)],
            [(5,0,Direction.LEFT), (4,0,Direction.LEFT), (3,0,Direction.LEFT), (2,0,Direction.LEFT), (1,0,Direction.LEFT)],
        ]
        offsets = [0, 0]
        resolve_collisions(streams, offsets)
        # At gTime=1: stream0 at (1,0), stream1 at (5,0) — different cells, no hit.
        # At gTime=3: stream0 at (3,0), stream1 at (3,0) → collision!
        # Both truncated to segi=2 (3 steps).
        assert len(streams[0]) == 3
        assert len(streams[1]) == 3

    def test_different_offsets(self):
        # Stream 0 (offset=0) arrives at (5,0) at segi=4 → gTime=5.
        # Stream 1 (offset=2) arrives at (5,0) at segi=2 → gTime=5.
        # Both from opposite directions → collision at gTime=5.
        streams = [
            [(1,0,Direction.RIGHT),(2,0,Direction.RIGHT),(3,0,Direction.RIGHT),(4,0,Direction.RIGHT),(5,0,Direction.RIGHT)],
            [(7,0,Direction.LEFT), (6,0,Direction.LEFT), (5,0,Direction.LEFT)],
        ]
        offsets = [0, 2]
        positions = resolve_collisions(streams, offsets)
        assert (5, 0) in positions
        assert len(streams[0]) == 5   # truncated to segi=4
        assert len(streams[1]) == 3   # truncated to segi=2


# ---------------------------------------------------------------------------
# Regression: simulate_incremental still works for non-splitter puzzles
# ---------------------------------------------------------------------------

class TestIncrementalSimulation:
    """simulate_incremental must still give the same answer as full simulation."""

    def test_incremental_matches_full_no_mirrors(self):
        from simulator import simulate_incremental
        c = cfg(10, 10, 0, 5, 'right', obstacles=[(8, 5)])
        full = simulate_laser(c, [(3, 5, '/')]) ['length']
        # Build incremental from empty mirrors first
        base = simulate_laser(c, [])
        inc = simulate_incremental(
            c,
            set(c.obstacles),
            [],
            base['path'],
            base['length'],
            (3, 5, '/'),
        )
        assert inc['length'] == full

    def test_incremental_mirror_not_on_path(self):
        from simulator import simulate_incremental
        # Mirror placed off the laser path should have no effect.
        c = cfg(10, 10, 0, 5, 'right')
        base = simulate_laser(c, [])
        inc = simulate_incremental(
            c,
            set(),
            [],
            base['path'],
            base['length'],
            (5, 9, '/'),  # (5,9) is not on the y=5 path
        )
        assert inc['length'] == base['length']

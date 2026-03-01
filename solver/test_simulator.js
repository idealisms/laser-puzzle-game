'use strict';
/**
 * Unit tests for simulator.js — verify that JS path-length computation
 * matches the Python simulator.py behaviour.
 *
 * Each test documents the expected output and asserts the JS result is
 * identical.  Run with:
 *
 *   cd solver && node --test test_simulator.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  UP, RIGHT, DOWN, LEFT,
  dirFromString, posKey,
  resolveCollisions,
  simulateLaser,
  simulateIncremental,
} = require('./simulator.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal puzzle config for testing.
 * obstacles and splitters are arrays of [x, y] or [x, y, dir] pairs.
 */
function cfg(width, height, lx, ly, ld, {
  obstacles = [],
  splitters = [],
  numMirrors = 0,
} = {}) {
  return {
    name: 'test',
    width,
    height,
    laserX: lx,
    laserY: ly,
    laserDir: dirFromString(ld),
    obstacles,
    numMirrors,
    splitters,
  };
}

/** Run simulateLaser and return its length. */
function len(config, mirrors = []) {
  return simulateLaser(config, mirrors).length;
}

// ---------------------------------------------------------------------------
// Basic beam behaviour (no splitters)
// ---------------------------------------------------------------------------

describe('TestStraightLaser', () => {
  it('horizontal_exits_right', () => {
    // 10-wide grid, laser at x=0 going right.
    // Steps: (0,5)→(1,5) … (9,5)→(10,5) [out of bounds] = 10 segments.
    const c = cfg(10, 10, 0, 5, 'right');
    assert.equal(len(c), 10);
  });

  it('vertical_exits_top', () => {
    // 10-tall grid, laser at y=9 going up.
    // Steps: y=9→8→…→0→-1 = 10 segments.
    const c = cfg(10, 10, 5, 9, 'up');
    assert.equal(len(c), 10);
  });

  it('laser_at_edge_exits_immediately', () => {
    // Laser at the last column going right exits in 1 step.
    const c = cfg(5, 5, 4, 2, 'right');
    assert.equal(len(c), 1);
  });
});

describe('TestObstacleStop', () => {
  it('obstacle_ahead', () => {
    // Laser at (0,5) going right; wall at (5,5).
    // Steps: (0→1),(1→2),(2→3),(3→4),(4→5) = 5 (the step onto the wall is counted).
    const c = cfg(10, 10, 0, 5, 'right', { obstacles: [[5, 5]] });
    assert.equal(len(c), 5);
  });

  it('obstacle_adjacent', () => {
    // Wall is immediately in front — 1 step.
    const c = cfg(10, 10, 0, 5, 'right', { obstacles: [[1, 5]] });
    assert.equal(len(c), 1);
  });

  it('termination_reason_obstacle', () => {
    const c = cfg(10, 10, 0, 5, 'right', { obstacles: [[3, 5]] });
    const result = simulateLaser(c, []);
    assert.equal(result.terminationReason, 'obstacle');
  });
});

describe('TestMirrorReflection', () => {
  it('slash_right_to_up', () => {
    // '/' mirror at (4,5): incoming RIGHT → exits UP.
    // 4 steps going right, then (4,4)→(4,3)→…→(4,-1) = 6 steps up. Total = 10.
    const c = cfg(10, 10, 0, 5, 'right');
    assert.equal(len(c, [[4, 5, '/']]), 10);
  });

  it('backslash_right_to_down', () => {
    // '\\' mirror at (4,5): incoming RIGHT → exits DOWN.
    // 4 steps right, then (4,6)→…→(4,10) = 5 steps down. Total = 9.
    const c = cfg(10, 10, 0, 5, 'right');
    assert.equal(len(c, [[4, 5, '\\']]), 9);
  });

  it('slash_up_to_right', () => {
    // '/' mirror at (3,7): incoming UP → exits RIGHT.
    // Laser at (3,9) going up: 2 steps to reach mirror, then goes right.
    // (3,9)→(3,8)→(3,7)[mirror, UP→RIGHT] then (4,7)→…→(9,7)→(10,7) = 2 + 7 = 9.
    const c = cfg(10, 10, 3, 9, 'up');
    assert.equal(len(c, [[3, 7, '/']]), 9);
  });

  it('loop_detection', () => {
    // Four mirrors form a clockwise rectangle; laser enters from the mid-point
    // of the top edge at (3,3) going right.  After completing one full circuit
    // the beam returns to (3,3) still travelling right — a state already in the
    // visited set → terminates as 'loop'.
    //
    // '\\' at (5,3): right→down  (top-right corner)
    // '/'  at (5,6): down→left   (bottom-right corner)
    // '\\' at (2,6): left→up     (bottom-left corner)
    // '/'  at (2,3): up→right    (top-left corner)
    const c = cfg(8, 8, 3, 3, 'right');
    const result = simulateLaser(c, [[5, 3, '\\'], [5, 6, '/'], [2, 6, '\\'], [2, 3, '/']]);
    assert.equal(result.terminationReason, 'loop');
  });
});

// ---------------------------------------------------------------------------
// Splitter behaviour (no collisions)
// ---------------------------------------------------------------------------

describe('TestSplitterActions', () => {
  it('splitter_wall', () => {
    // Splitter at (5,5) with orientation='left'.
    // Laser going RIGHT hits the hypotenuse (opposite of 'left' = 'right') → wall.
    // 5 steps to reach the splitter (counted); then blocked.
    const c = cfg(10, 10, 0, 5, 'right', { splitters: [[5, 5, 'left']] });
    const result = simulateLaser(c, []);
    assert.equal(result.length, 5);
    assert.equal(result.terminationReason, 'obstacle');
  });

  it('splitter_reflect_down', () => {
    // Splitter at (5,5) with orientation='up'.
    // RIGHT is perpendicular to UP → reflects toward opposite('up') = DOWN.
    // 5 steps right to splitter, then 5 steps down to exit (grid 10x10, y=5 going down).
    // Down: (5,6)→(5,7)→(5,8)→(5,9)→(5,10) = 5 steps. Total = 10.
    const c = cfg(10, 10, 0, 5, 'right', { splitters: [[5, 5, 'up']] });
    assert.equal(len(c), 10);
  });

  it('splitter_split_counts_both_beams', () => {
    // Splitter at (5,7) orientation='right' in a 15x15 grid.
    // Laser at (0,7) going right: 5 steps to splitter (sub_offset=5).
    // UP beam from (5,7): 8 steps to exit (y=7→6→…→0→-1).
    // DOWN beam from (5,7): 8 steps to exit (y=7→8→…→14→15).
    // No collisions (beams go straight up/down on the same column but
    // diverge immediately and never share a cell at the same global time).
    // Total = 5 + 8 + 8 = 21.
    const c = cfg(15, 15, 0, 7, 'right', { splitters: [[5, 7, 'right']] });
    assert.equal(len(c), 21);
  });

  it('splitter_split_both_beams_symmetric', () => {
    // Splitter at (7,4) orientation='down' in a 15x10 grid.
    // Laser at (7,0) going down: 4 steps (sub_offset=4).
    // LEFT beam: 8 steps to exit (x=7→6→…→0→-1).
    // RIGHT beam: 8 steps to exit (x=7→8→…→14→15).
    // Total = 4 + 8 + 8 = 20.
    const c = cfg(15, 10, 7, 0, 'down', { splitters: [[7, 4, 'down']] });
    assert.equal(len(c), 20);
  });
});

// ---------------------------------------------------------------------------
// Splitter with head-on collision (the key new behaviour)
// ---------------------------------------------------------------------------

/**
 * Reference scenario (same-cell collision):
 *
 *   Grid: 13 wide × 13 tall
 *   Laser at (0,6) going RIGHT
 *   Splitter at (6,6) orientation='right'  →  UP and DOWN sub-beams
 *
 *   Mirrors:
 *     '/'  at (6,3)  : UP   beam → RIGHT
 *     '\\' at (10,3) : RIGHT beam → DOWN
 *     '\\' at (6,9)  : DOWN  beam → RIGHT
 *     '/'  at (10,9) : RIGHT beam → UP
 *
 *   Both sub-beams converge at (10,6) at global time 16 from opposite
 *   directions (DOWN from the UP-branch, UP from the DOWN-branch).
 *
 *   Stream lengths after collision truncation:
 *     Primary  : 6 segments  (laser → splitter)
 *     UP-branch: 10 segments (splitter → (10,6) inclusive)
 *     DN-branch: 10 segments (splitter → (10,6) inclusive)
 *     Total    : 26
 *
 *   Without collision detection the beams would loop through the mirror
 *   circuit, yielding a much larger count (53 in CPython DFS order).
 */

const COLLISION_MIRRORS = [
  [6, 3, '/'],    // UP beam: UP → RIGHT
  [10, 3, '\\'],  // RIGHT beam: RIGHT → DOWN
  [6, 9, '\\'],   // DOWN beam: DOWN → RIGHT
  [10, 9, '/'],   // RIGHT beam: RIGHT → UP
];

function collisionConfig() {
  return cfg(13, 13, 0, 6, 'right', { splitters: [[6, 6, 'right']] });
}

describe('TestCollisionDetection', () => {
  it('collision_total_length', () => {
    const c = collisionConfig();
    assert.equal(len(c, COLLISION_MIRRORS), 26);
  });

  it('no_mirrors_no_collision', () => {
    // Without mirrors the UP/DOWN beams go straight — they never share a
    // cell at the same global time, so no collision.
    // Primary: 6, UP: 7 (y 6→5→…→0→-1), DOWN: 7 (y 6→7→…→12→13). Total = 20.
    const c = collisionConfig();
    assert.equal(len(c), 20);
  });

  it('partial_mirrors_no_collision', () => {
    // Only the '/' mirror at (6,3) — UP beam turns right but DOWN beam
    // keeps going down.  They never meet.
    // Primary: 6 steps (to splitter)
    // UP-branch: 3 up to mirror + 7 right to exit = 10
    // DOWN-branch: 7 down to exit = 7
    // Total = 23
    const c = collisionConfig();
    assert.equal(len(c, [[6, 3, '/']]), 23);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for resolveCollisions directly
// ---------------------------------------------------------------------------

describe('TestResolveCollisionsDirect', () => {
  it('no_collision_streams_on_different_rows', () => {
    // Two streams going in the same direction on different rows — they never
    // share a cell, so no collision regardless of the new direction-agnostic rule.
    const streams = [
      [[1, 0, RIGHT], [2, 0, RIGHT]],
      [[1, 1, RIGHT], [2, 1, RIGHT]],
    ];
    const offsets = [0, 0];
    const positions = resolveCollisions(streams, offsets);
    assert.deepEqual(positions, []);
    assert.equal(streams[0].length, 2);
    assert.equal(streams[1].length, 2);
  });

  it('same_direction_same_cell_is_collision', () => {
    // Two streams going RIGHT along the same row share every cell simultaneously.
    // First shared cell is (1,0) at gTime=1; both truncated to 1 step.
    const streams = [
      [[1, 0, RIGHT], [2, 0, RIGHT]],
      [[1, 0, RIGHT], [2, 0, RIGHT]],
    ];
    const offsets = [0, 0];
    const positions = resolveCollisions(streams, offsets);
    assert.ok(positions.some(p => p[0] === 1 && p[1] === 0));
    assert.equal(streams[0].length, 1);
    assert.equal(streams[1].length, 1);
  });

  it('same_cell_same_time_truncates', () => {
    // Stream 0 arrives at (5,3) going RIGHT at gTime=3 (offset=0, segi=2).
    // Stream 1 arrives at (5,3) going LEFT at gTime=3 (offset=0, segi=2).
    // Expected: both truncated to 3 steps (segi 0,1,2).
    const streams = [
      [[3, 3, RIGHT], [4, 3, RIGHT], [5, 3, RIGHT]],
      [[7, 3, LEFT],  [6, 3, LEFT],  [5, 3, LEFT]],
    ];
    const offsets = [0, 0];
    const positions = resolveCollisions(streams, offsets);
    assert.ok(positions.some(p => p[0] === 5 && p[1] === 3));
    assert.equal(streams[0].length, 3);  // truncated to segi=2 → keeps 3 steps
    assert.equal(streams[1].length, 3);
  });

  it('cell_at_mirror_is_collision', () => {
    // Previously mirror cells were excluded; now any same-cell same-time pair
    // collides regardless of cell content.
    const streams = [
      [[5, 3, RIGHT]],
      [[5, 3, LEFT]],
    ];
    const offsets = [0, 0];
    const positions = resolveCollisions(streams, offsets);
    assert.ok(positions.some(p => p[0] === 5 && p[1] === 3));
    assert.equal(streams[0].length, 1);
    assert.equal(streams[1].length, 1);
  });

  it('perpendicular_same_cell_is_collision', () => {
    // Stream 0 arrives at (5,3) going RIGHT at gTime=3.
    // Stream 1 arrives at (5,3) going DOWN at gTime=3.
    // Perpendicular, not head-on — but same cell same time → collision.
    const streams = [
      [[3, 3, RIGHT], [4, 3, RIGHT], [5, 3, RIGHT]],
      [[5, 1, DOWN],  [5, 2, DOWN],  [5, 3, DOWN]],
    ];
    const offsets = [0, 0];
    const positions = resolveCollisions(streams, offsets);
    assert.ok(positions.some(p => p[0] === 5 && p[1] === 3));
    assert.equal(streams[0].length, 3);
    assert.equal(streams[1].length, 3);
  });

  it('crossing_truncates', () => {
    // Stream 0 arrives at (4,3) going RIGHT at gTime=1 (offset=0, segi=0).
    // Stream 1 arrives at (5,3) going LEFT at gTime=1 (offset=0, segi=0).
    // delta(RIGHT)=(1,0); b.pos=(5,3)=a.pos+(1,0) and b.dir=LEFT=opposite(RIGHT).
    // Crossing collision at midpoint (4.5, 3.0).
    const streams = [
      [[4, 3, RIGHT]],
      [[5, 3, LEFT]],
    ];
    const offsets = [0, 0];
    const positions = resolveCollisions(streams, offsets);
    assert.ok(positions.some(p => p[0] === 4.5 && p[1] === 3.0));
    assert.equal(streams[0].length, 1);
    assert.equal(streams[1].length, 1);
  });

  it('earliest_collision_kept_per_pair', () => {
    // Two collisions for the same stream pair: at gTime=2 and gTime=4.
    // Only the earliest (gTime=2) should be used for truncation.
    // Stream 0: RIGHT at x=1,2,3,4,5 on y=0 (offsets=0 so gTimes 1–5)
    // Stream 1: LEFT  at x=5,4,3,2,1 on y=0 (gTimes 1–5)
    const streams = [
      [[1,0,RIGHT],[2,0,RIGHT],[3,0,RIGHT],[4,0,RIGHT],[5,0,RIGHT]],
      [[5,0,LEFT], [4,0,LEFT], [3,0,LEFT], [2,0,LEFT], [1,0,LEFT]],
    ];
    const offsets = [0, 0];
    resolveCollisions(streams, offsets);
    // At gTime=1: stream0 at (1,0), stream1 at (5,0) — different cells, no hit.
    // At gTime=3: stream0 at (3,0), stream1 at (3,0) → collision!
    // Both truncated to segi=2 (3 steps).
    assert.equal(streams[0].length, 3);
    assert.equal(streams[1].length, 3);
  });

  it('different_offsets', () => {
    // Stream 0 (offset=0) arrives at (5,0) at segi=4 → gTime=5.
    // Stream 1 (offset=2) arrives at (5,0) at segi=2 → gTime=5.
    // Both from opposite directions → collision at gTime=5.
    const streams = [
      [[1,0,RIGHT],[2,0,RIGHT],[3,0,RIGHT],[4,0,RIGHT],[5,0,RIGHT]],
      [[7,0,LEFT], [6,0,LEFT], [5,0,LEFT]],
    ];
    const offsets = [0, 2];
    const positions = resolveCollisions(streams, offsets);
    assert.ok(positions.some(p => p[0] === 5 && p[1] === 0));
    assert.equal(streams[0].length, 5);   // truncated to segi=4
    assert.equal(streams[1].length, 3);   // truncated to segi=2
  });
});

// ---------------------------------------------------------------------------
// Regression: simulateIncremental still works for non-splitter puzzles
// ---------------------------------------------------------------------------

describe('TestIncrementalSimulation', () => {
  it('incremental_matches_full_no_mirrors', () => {
    const c = cfg(10, 10, 0, 5, 'right', { obstacles: [[8, 5]] });
    const full = simulateLaser(c, [[3, 5, '/']]).length;
    // Build incremental from empty mirrors first
    const base = simulateLaser(c, []);
    const obstacleSet = new Set(c.obstacles.map(([x, y]) => posKey(x, y)));
    const inc = simulateIncremental(
      c,
      obstacleSet,
      [],
      base.path,
      base.length,
      [3, 5, '/'],
    );
    assert.equal(inc.length, full);
  });

  it('incremental_mirror_not_on_path', () => {
    // Mirror placed off the laser path should have no effect.
    const c = cfg(10, 10, 0, 5, 'right');
    const base = simulateLaser(c, []);
    const inc = simulateIncremental(
      c,
      new Set(),
      [],
      base.path,
      base.length,
      [5, 9, '/'],  // (5,9) is not on the y=5 path
    );
    assert.equal(inc.length, base.length);
  });
});

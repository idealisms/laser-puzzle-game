'use strict';
/**
 * Unit tests for simulator.ts — verify that the solver wrapper over the shared
 * simulate.ts module produces correct results.
 *
 * resolveCollisions tests have been moved to src/game/engine/__tests__/simulate.test.ts.
 * This file retains:
 *   - Smoke tests for the simulateLaser adapter (basic beam, obstacle, mirror, splitter)
 *   - Collision integration tests via simulateLaser
 *   - simulateIncremental regression tests
 *
 * Run with:
 *   cd solver && node --import tsx --test test_simulator.ts
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  UP, RIGHT, DOWN, LEFT,
  dirFromString, posKey,
  simulateLaser,
  simulateIncremental,
} = require('./simulator');

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
// Basic beam behaviour (no splitters) — smoke tests for the adapter
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
    // Four mirrors form a clockwise rectangle.
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
    // No collisions. Total = 5 + 8 + 8 = 21.
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
// Splitter with head-on collision
// ---------------------------------------------------------------------------

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
    // Primary: 6, UP: 7 (y 6→5→…→0→-1), DOWN: 7 (y 6→7→…→12→13). Total = 20.
    const c = collisionConfig();
    assert.equal(len(c), 20);
  });

  it('partial_mirrors_no_collision', () => {
    // Only the '/' mirror at (6,3) — UP beam turns right but DOWN beam keeps going.
    // Primary: 6, UP: 3+7=10, DOWN: 7. Total = 23.
    const c = collisionConfig();
    assert.equal(len(c, [[6, 3, '/']]), 23);
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

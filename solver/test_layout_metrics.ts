'use strict';
/**
 * Unit tests for layout_metrics.ts.
 *
 * Run with:
 *   cd solver && node --import tsx --test test_layout_metrics.ts
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { measureShape, checkLayout, playableBounds } = require('./layout_metrics');

const W = 15, H = 20;

function level(overrides: any) {
  return {
    gridWidth: W,
    gridHeight: H,
    laserConfig: { x: 0, y: 0, direction: 'right' },
    obstacles: [],
    optimalSolution: [],
    ...overrides,
  };
}

describe('measureShape', () => {
  it('flags a solution that loops around the perimeter of an open grid', () => {
    const shape = measureShape(level({
      optimalSolution: [
        { x: 14, y: 0, type: '\\' },  // right -> down
        { x: 14, y: 19, type: '/' },  // down -> left
        { x: 0, y: 19, type: '\\' },  // left -> up
      ],
    }));
    assert.equal(shape.edgePathShare, 1);
    assert.equal(shape.anchoredShare, 0);
    assert.equal(checkLayout(shape).length, 2);
  });

  it('accepts an interior path blocked by an edge-anchored wall', () => {
    const wall = Array.from({ length: 11 }, (_, x) => ({ x, y: 10 }));
    const shape = measureShape(level({
      laserConfig: { x: 7, y: 0, direction: 'down' },
      obstacles: wall,
    }));
    // The beam covers (7,1)..(7,9); the wall cell it stops at is not part of the path.
    assert.equal(shape.visits.size, 9);
    assert.equal(shape.edgePathShare, 0);
    assert.equal(shape.anchoredShare, 1);
    assert.deepEqual(checkLayout(shape), []);
  });

  it('treats fully blocked border rows and columns as outside the playable area', () => {
    const border = [];
    for (let x = 0; x < W; x++) border.push({ x, y: 0 }, { x, y: H - 1 });
    for (let y = 1; y < H - 1; y++) border.push({ x: 0, y }, { x: W - 1, y });
    const walls = new Set(border.map(c => `${c.x},${c.y}`));
    assert.deepEqual(playableBounds(walls, W, H), { left: 1, right: W - 2, top: 1, bottom: H - 2 });

    // A stub touching the inner edge of the border counts as anchored; a floating block does not.
    const shape = measureShape(level({
      laserConfig: { x: 1, y: 5, direction: 'right' },
      obstacles: [...border, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 7, y: 12 }, { x: 8, y: 12 }],
    }));
    assert.equal(shape.anchoredShare, 0.5);
  });
});

describe('generated levels', () => {
  it('measures every level in solver/levels without throwing', () => {
    const dir = path.join(__dirname, 'levels');
    for (const file of fs.readdirSync(dir).filter((f: string) => f.endsWith('.json'))) {
      const shape = measureShape(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
      assert.ok(shape.edgePathShare >= 0 && shape.edgePathShare <= 1, file);
      assert.ok(shape.anchoredShare >= 0 && shape.anchoredShare <= 1, file);
    }
  });
});

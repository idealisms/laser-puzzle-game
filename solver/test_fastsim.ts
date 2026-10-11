'use strict';
/**
 * Differential tests: fastsim.ts must agree with calculateLaserPath in
 * src/game/engine/simulate.ts on score and visited cells.
 *
 * Run: node --require tsx/cjs --test test_fastsim.ts
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateLaserPath } = require('../src/game/engine/simulate');
const { createFastSim } = require('./fastsim');
const { PUZZLES } = require('./puzzles');
const fs = require('fs');
const path = require('path');

const INT_TO_DIR = ['up', 'right', 'down', 'left'];

function reference(config, mirrors) {
  const obstacles = [
    ...config.obstacles.map(([x, y]) => ({ x, y, type: 'wall' })),
    ...(config.splitters || []).map(([x, y, o]) => ({ x, y, type: 'splitter', orientation: o })),
    ...(config.gates || []).map(([x, y, o]) => ({ x, y, type: 'gate', orientation: o })),
  ];
  const lp = calculateLaserPath(
    { x: config.laserX, y: config.laserY, direction: INT_TO_DIR[config.laserDir] },
    mirrors.map(([x, y, type]) => ({ position: { x, y }, type })),
    obstacles,
    { width: config.width, height: config.height },
  );
  const cells = new Set();
  for (const st of lp.streams)
    for (const seg of st.segments) {
      const { x, y } = seg.end;
      if (x >= 0 && x < config.width && y >= 0 && y < config.height) cells.add(x * config.height + y);
    }
  return { length: lp.totalLength, cells, streams: lp.streams.length, collisions: lp.collisionPoints.length };
}

function fast(sim, config, mirrors) {
  sim.mirrors.fill(0);
  for (const [x, y, t] of mirrors) sim.mirrors[x * config.height + y] = t === '/' ? 1 : 2;
  const buf = new Uint8Array(sim.cellBytes);
  const length = sim.run(buf);
  const cells = new Set();
  for (let c = 0; c < config.width * config.height; c++) if ((buf[c >> 3] >> (c & 7)) & 1) cells.add(c);
  return { length, cells };
}

// Deterministic PRNG (mulberry32)
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('fastsim matches calculateLaserPath', () => {
  for (const [date, config] of Object.entries(PUZZLES) as [string, any][]) {
    it(date, () => {
      const sim = createFastSim(config);
      const rand = rng(date.split('-').reduce((a, b) => a * 31 + Number(b), 7));
      const blocked = new Set([
        ...config.obstacles.map(([x, y]) => x * config.height + y),
        ...(config.splitters || []).map(([x, y]) => x * config.height + y),
        ...(config.gates || []).map(([x, y]) => x * config.height + y),
        config.laserX * config.height + config.laserY,
      ]);
      let multiStream = 0;
      const check = (mirrors) => {
        const ref = reference(config, mirrors);
        if (ref.streams > 1) multiStream++;
        const got = fast(sim, config, mirrors);
        const ctx = `${date} mirrors=${JSON.stringify(mirrors)}`;
        assert.equal(got.length, ref.length, ctx);
        assert.deepEqual([...got.cells].sort((a, b) => a - b), [...ref.cells].sort((a, b) => a - b), ctx);
      };

      // The shipped optimal solution, if this puzzle has been generated.
      const levelFile = path.join(__dirname, 'levels', `${date}.json`);
      if (fs.existsSync(levelFile)) {
        const level = JSON.parse(fs.readFileSync(levelFile, 'utf8'));
        check(level.optimalSolution.map(({ x, y, type }) => [x, y, type]));
      }

      for (let trial = 0; trial < 300; trial++) {
        // Grow a placement by dropping mirrors on cells the beam currently visits,
        // with occasional off-beam placements.
        const mirrors = [];
        const used = new Set();
        const n = 1 + Math.floor(rand() * config.numMirrors);
        for (let i = 0; i < n; i++) {
          const ref = reference(config, mirrors);
          const pool = rand() < 0.9
            ? [...ref.cells].filter(c => !blocked.has(c) && !used.has(c))
            : Array.from({ length: config.width * config.height }, (_, c) => c)
                .filter(c => !blocked.has(c) && !used.has(c));
          if (pool.length === 0) break;
          const c = pool[Math.floor(rand() * pool.length)];
          used.add(c);
          mirrors.push([Math.floor(c / config.height), c % config.height, rand() < 0.5 ? '/' : '\\']);
        }
        check(mirrors);
      }
      if ((config.splitters || []).length > 0) assert.ok(multiStream > 0, `${date}: no trial reached a splitter`);
    });
  }
});

// Real puzzles rarely produce collisions. Boards that are mirror-symmetric
// about the row of a splitter make the two split beams trace mirrored paths
// and meet on the axis, so they collide often; random perturbations break the
// symmetry to cover crossings and near misses.
describe('fastsim matches calculateLaserPath on symmetric splitter boards', () => {
  it('random symmetric boards', () => {
    const rand = rng(12345);
    const FLIP_DIR = { up: 'down', down: 'up', left: 'left', right: 'right' };
    const FLIP_MIRROR = { '/': '\\', '\\': '/' };
    const dirs = ['up', 'right', 'down', 'left'];
    let collisions = 0;
    for (let trial = 0; trial < 20000; trial++) {
      const width = 4 + Math.floor(rand() * 9);
      const half = 1 + Math.floor(rand() * 5);
      const height = 2 * half + 1, axis = half;
      const splitX = 1 + Math.floor(rand() * (width - 2));
      const config = {
        width, height, laserX: 0, laserY: axis, laserDir: 1,
        obstacles: [], splitters: [[splitX, axis, 'right']], gates: [], numMirrors: 0,
      };
      const mirrors = [];
      const taken = new Set([axis, splitX * height + axis]);
      // Adds a random piece at (x, y) and returns a function that adds its
      // mirror image at (x, y2).
      const addPiece = (x, y) => {
        const r = rand();
        if (r < 0.6) {
          const t = rand() < 0.5 ? '/' : '\\';
          mirrors.push([x, y, t]);
          return (y2) => mirrors.push([x, y2, FLIP_MIRROR[t]]);
        }
        if (r < 0.75) {
          config.obstacles.push([x, y]);
          return (y2) => config.obstacles.push([x, y2]);
        }
        const list = r < 0.9 ? config.splitters : config.gates;
        const d = dirs[Math.floor(rand() * 4)];
        list.push([x, y, d]);
        return (y2) => list.push([x, y2, FLIP_DIR[d]]);
      };
      const n = Math.floor(rand() * width * half * 0.6);
      for (let i = 0; i < n; i++) {
        const x = Math.floor(rand() * width), y = Math.floor(rand() * half);
        const y2 = 2 * axis - y;
        const k = x * height + y, k2 = x * height + y2;
        const symmetric = rand() < 0.9;
        if (!taken.has(k)) {
          taken.add(k);
          const addMirrorImage = addPiece(x, y);
          if (symmetric && !taken.has(k2)) { taken.add(k2); addMirrorImage(y2); }
        }
        if (!symmetric && !taken.has(k2)) { taken.add(k2); addPiece(x, y2); }
      }

      const ref = reference(config, mirrors);
      if (ref.collisions > 0) collisions++;
      const got = fast(createFastSim(config), config, mirrors);
      const ctx = JSON.stringify({ config, mirrors });
      assert.equal(got.length, ref.length, ctx);
      assert.deepEqual([...got.cells].sort((a, b) => a - b), [...ref.cells].sort((a, b) => a - b), ctx);
    }
    assert.ok(collisions > 1000, `only ${collisions} boards had collisions`);
  });
});

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
const { configToObstacles } = require('./obstacles');
const fs = require('fs');
const path = require('path');

const INT_TO_DIR = ['up', 'right', 'down', 'left'];

function reference(config, mirrors) {
  const obstacles = configToObstacles(config);
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
  // Collisions with a lit cell are reported on the cell edge, at a half coordinate.
  const litCollisions = lp.collisionPoints.filter(p => !Number.isInteger(p.x) || !Number.isInteger(p.y)).length;
  // Did any beam go through a portal? (A segment starting away from where the last one ended.)
  const teleports = lp.streams.some(st => st.segments.some((seg, i) =>
    i > 0 && (seg.start.x !== st.segments[i - 1].end.x || seg.start.y !== st.segments[i - 1].end.y)));
  return { length: lp.totalLength, cells, streams: lp.streams.length, collisions: lp.collisionPoints.length, litCollisions, teleports };
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
  let splitterPuzzles = 0, splitterPuzzlesReached = 0;
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
      if ((config.splitters || []).length > 0) {
        splitterPuzzles++;
        if (multiStream > 0) splitterPuzzlesReached++;
      }
    });
  }

  it('random placements trigger splits on most splitter puzzles', () => {
    assert.ok(splitterPuzzlesReached >= splitterPuzzles * 0.8,
      `splits reached on only ${splitterPuzzlesReached} of ${splitterPuzzles} splitter puzzles`);
  });
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

describe('fastsim lit cells', () => {
  // Mirrors are reversible, so a beam only runs back along a lit path after
  // passing something one-way (a gate or a splitter). Small boards dense with
  // both still produce lit-cell collisions only rarely, hence many trials.
  it('random dense boards', () => {
    const rand = rng(777);
    const dirs = ['up', 'right', 'down', 'left'];
    let litCollisions = 0;
    for (let trial = 0; trial < 100000; trial++) {
      const width = 4 + Math.floor(rand() * 7), height = 4 + Math.floor(rand() * 7);
      const config = {
        width, height, laserX: 0, laserY: Math.floor(rand() * height), laserDir: 1,
        obstacles: [], splitters: [], gates: [], numMirrors: 0,
      };
      const mirrors = [];
      for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++) {
          if (x === config.laserX && y === config.laserY) continue;
          const r = rand();
          if (r < 0.3) mirrors.push([x, y, rand() < 0.5 ? '/' : '\\']);
          else if (r < 0.4) config.splitters.push([x, y, dirs[Math.floor(rand() * 4)]]);
          else if (r < 0.6) config.gates.push([x, y, dirs[Math.floor(rand() * 4)]]);
          else if (r < 0.62) config.obstacles.push([x, y]);
        }
      const ref = reference(config, mirrors);
      if (ref.litCollisions > 0) litCollisions++;
      const got = fast(createFastSim(config), config, mirrors);
      const ctx = JSON.stringify({ config, mirrors });
      assert.equal(got.length, ref.length, ctx);
      assert.deepEqual([...got.cells].sort((a, b) => a - b), [...ref.cells].sort((a, b) => a - b), ctx);
    }
    assert.ok(litCollisions > 50, `only ${litCollisions} boards had lit-cell collisions`);
  });

  // Same rig as the lit-cell tests in simulate.test.ts: the up beam passes the
  // gate at (3,8) and runs head-on into (4,8), which the down beam lit earlier.
  const config = {
    width: 10, height: 10, laserX: 9, laserY: 5, laserDir: 3,
    obstacles: [], splitters: [[6, 5, 'left']], gates: [[3, 8, 'right']], numMirrors: 4,
  };

  it('a beam running head-on into a lit cell stops there', () => {
    const mirrors = [[6, 8, '/'], [6, 2, '\\'], [1, 2, '/'], [1, 8, '\\']];
    const ref = reference(config, mirrors);
    assert.equal(ref.litCollisions, 1);
    assert.equal(fast(createFastSim(config), config, mirrors).length, 26);
    assert.equal(ref.length, 26);
  });

  it('a beam crossing a lit cell perpendicularly passes through', () => {
    const mirrors = [[6, 8, '/'], [6, 2, '\\'], [4, 2, '/']];
    assert.equal(fast(createFastSim(config), config, mirrors).length, 22);
    assert.equal(reference(config, mirrors).length, 22);
  });
});

// Portals join cells of any parity, so beams can meet beside a pair after
// going through different portals, or swap across an edge beside one. Random dense boards
// with splitters, gates and 1–3 portal pairs cover these; in half of them each
// pair is mirror-symmetric about the laser's row, so that split beams reach
// both portals of a pair at the same time.
describe('fastsim matches calculateLaserPath with portals', () => {
  it('random dense boards with portals', () => {
    const rand = rng(4242);
    const dirs = ['up', 'right', 'down', 'left'];
    let teleports = 0, collisions = 0, litCollisions = 0;
    for (let trial = 0; trial < 60000; trial++) {
      const width = 4 + Math.floor(rand() * 8), height = 5 + Math.floor(rand() * 7);
      const laserY = Math.floor(rand() * height);
      const config = {
        width, height, laserX: 0, laserY, laserDir: 1,
        obstacles: [], splitters: [], gates: [], portals: [], numMirrors: 0,
      };
      const taken = new Set([laserY]);
      const free = (x, y) => x >= 0 && x < width && y >= 0 && y < height && !taken.has(x * height + y);
      const symmetric = rand() < 0.5;
      const pairs = 1 + Math.floor(rand() * 3);
      for (let pair = 1; pair <= pairs; pair++) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const x1 = Math.floor(rand() * width), y1 = Math.floor(rand() * height);
          const x2 = symmetric ? x1 : Math.floor(rand() * width);
          const y2 = symmetric ? 2 * laserY - y1 : Math.floor(rand() * height);
          if ((x1 === x2 && y1 === y2) || !free(x1, y1) || !free(x2, y2)) continue;
          taken.add(x1 * height + y1); taken.add(x2 * height + y2);
          config.portals.push([x1, y1, pair], [x2, y2, pair]);
          break;
        }
      }
      const mirrors = [];
      for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++) {
          if (!free(x, y)) continue;
          const r = rand();
          if (r < 0.3) mirrors.push([x, y, rand() < 0.5 ? '/' : '\\']);
          else if (r < 0.4) config.splitters.push([x, y, dirs[Math.floor(rand() * 4)]]);
          else if (r < 0.5) config.gates.push([x, y, dirs[Math.floor(rand() * 4)]]);
          else if (r < 0.53) config.obstacles.push([x, y]);
        }
      const ref = reference(config, mirrors);
      if (ref.teleports) {
        teleports++;
        if (ref.collisions > 0) collisions++;
        if (ref.litCollisions > 0) litCollisions++;
      }
      const got = fast(createFastSim(config), config, mirrors);
      const ctx = JSON.stringify({ config, mirrors });
      assert.equal(got.length, ref.length, ctx);
      assert.deepEqual([...got.cells].sort((a, b) => a - b), [...ref.cells].sort((a, b) => a - b), ctx);
    }
    assert.ok(teleports > 10000, `only ${teleports} boards used a portal`);
    assert.ok(collisions > 150, `only ${collisions} boards with a teleport had collisions`);
    assert.ok(litCollisions > 100, `only ${litCollisions} boards with a teleport had lit-cell collisions`);
  });

  // Two beams that pass each other head-on through a pair become partners and
  // never collide again. Boards symmetric about a splitter's row, with portal
  // pairs placed symmetrically, send the split beams through both portals of a
  // pair at once; about 8% of them score differently with and without the
  // partner rule (measured when it was added).
  it('random symmetric boards with portal pairs', () => {
    const rand = rng(31337);
    for (let trial = 0; trial < 20000; trial++) {
      const { config, mirrors } = symmetricPortalBoard(rand);
      const ref = reference(config, mirrors);
      const got = fast(createFastSim(config), config, mirrors);
      const ctx = JSON.stringify({ config, mirrors });
      assert.equal(got.length, ref.length, ctx);
      assert.deepEqual([...got.cells].sort((a, b) => a - b), [...ref.cells].sort((a, b) => a - b), ctx);
    }
  });

  // The portal rigs from simulate.test.ts: a splitter at (5,5) sends its up
  // beam left through (3,2) at t=8.
  const rig = (portals, mirrors) => {
    const config = {
      width: 10, height: 10, laserX: 2, laserY: 5, laserDir: 1,
      obstacles: [], splitters: [[5, 5, 'right']], gates: [], portals, numMirrors: 0,
    };
    return { ref: reference(config, mirrors).length, got: fast(createFastSim(config), config, mirrors).length };
  };
  const up = [5, 2, '\\'];

  it('head-on through different portals of a pair', () => {
    assert.deepEqual(rig([[3, 2, 1], [7, 8, 1]], [up, [5, 8, '\\']]), { ref: 23, got: 23 });
  });

  it('same direction through different portals of a pair', () => {
    assert.deepEqual(rig([[3, 2, 1], [3, 8, 1]], [up, [5, 8, '/']]), { ref: 21, got: 21 });
  });

  it('head-on into a portal lit earlier', () => {
    assert.deepEqual(rig([[3, 2, 1], [8, 9, 1]], [up, [5, 8, '/'], [1, 8, '\\'], [1, 2, '/']]), { ref: 32, got: 32 });
  });

  it('swapping across the edge beside a portal', () => {
    assert.deepEqual(rig([[3, 2, 1], [6, 8, 1]], [up, [5, 6, '/'], [4, 6, '/'], [4, 8, '\\']]), { ref: 25, got: 25 });
  });
});

// Mirror-symmetric board about the laser's row with a splitter on the axis and
// symmetric portal pairs, so the split beams reach both portals of a pair at once.
function symmetricPortalBoard(rand: () => number) {
  const FLIP_DIR: any = { up: 'down', down: 'up', left: 'left', right: 'right' };
  const FLIP_MIRROR: any = { '/': '\\', '\\': '/' };
  const dirs = ['up', 'right', 'down', 'left'];
  const width = 5 + Math.floor(rand() * 8);
  const half = 2 + Math.floor(rand() * 5);
  const height = 2 * half + 1, axis = half;
  const splitX = 1 + Math.floor(rand() * (width - 2));
  const config: any = {
    width, height, laserX: 0, laserY: axis, laserDir: 1,
    obstacles: [], splitters: [[splitX, axis, 'right']], gates: [], portals: [], numMirrors: 0,
  };
  const mirrors: any[] = [];
  const taken = new Set([axis, splitX * height + axis]);
  const pairs = 1 + Math.floor(rand() * 2);
  for (let pair = 1; pair <= pairs; pair++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = Math.floor(rand() * width), y = Math.floor(rand() * half), y2 = 2 * axis - y;
      if (taken.has(x * height + y) || taken.has(x * height + y2)) continue;
      taken.add(x * height + y); taken.add(x * height + y2);
      config.portals.push([x, y, pair], [x, y2, pair]);
      break;
    }
  }
  const n = Math.floor(rand() * width * half * 0.6);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rand() * width), y = Math.floor(rand() * half), y2 = 2 * axis - y;
    if (taken.has(x * height + y) || taken.has(x * height + y2)) continue;
    taken.add(x * height + y);
    const symmetric = rand() < 0.9;
    if (symmetric) taken.add(x * height + y2);
    const r = rand();
    if (r < 0.65) {
      const t = rand() < 0.5 ? '/' : '\\';
      mirrors.push([x, y, t]); if (symmetric) mirrors.push([x, y2, FLIP_MIRROR[t]]);
    } else if (r < 0.8) {
      config.obstacles.push([x, y]); if (symmetric) config.obstacles.push([x, y2]);
    } else {
      const list = r < 0.9 ? config.splitters : config.gates;
      const d = dirs[Math.floor(rand() * 4)];
      list.push([x, y, d]); if (symmetric) list.push([x, y2, FLIP_DIR[d]]);
    }
  }
  return { config, mirrors };
}

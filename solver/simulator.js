'use strict';
// Ported from simulator.py — pure functional laser path simulation.

const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

// [dx, dy] indexed by direction
const DELTAS = [[0,-1],[1,0],[0,1],[-1,0]];

// opposite[dir] = reverse direction
const OPPOSITE = [DOWN, LEFT, UP, RIGHT]; // [2, 3, 0, 1]

// REFLECT[mirrorType][incomingDir] = outgoingDir
// '/' : UP→RIGHT, RIGHT→UP, DOWN→LEFT, LEFT→DOWN
// '\' : UP→LEFT,  RIGHT→DOWN, DOWN→RIGHT, LEFT→UP
const REFLECT = {
  '/':  [RIGHT, UP, LEFT, DOWN],   // indexed [UP, RIGHT, DOWN, LEFT]
  '\\': [LEFT, DOWN, RIGHT, UP],
};

function dirFromString(s) {
  return { up: UP, right: RIGHT, down: DOWN, left: LEFT }[s];
}

// Encode (x, y) as a single integer. Grid is at most 15×20, so x*100+y is safe.
function posKey(x, y) { return x * 100 + y; }
function decodePos(k) { return [Math.floor(k / 100), k % 100]; }

// Encode (x, y, dir) for visited-state tracking.
function stateKey(x, y, dir) { return (x * 20 + y) * 4 + dir; }

function getSplitDirections(dir) {
  return (dir === LEFT || dir === RIGHT) ? [UP, DOWN] : [LEFT, RIGHT];
}

function getSplitterAction(laserDir, orientation) {
  const orientDir = dirFromString(orientation);
  if (laserDir === orientDir) return 'split';
  if (laserDir === OPPOSITE[orientDir]) return 'wall';
  return 'reflect';
}

/**
 * Detect and truncate beam collisions across multiple streams.
 * Matches the Python resolveCollisions behaviour exactly.
 * Mutates streams in place; returns array of collision positions.
 */
function resolveCollisions(streams, streamOffsets) {
  // byCellTime: encoded(gTime,x,y) -> [{si,segi,x,y,gTime}]
  // byTime:     gTime -> [{si,segi,x,y,d}]
  const byCellTime = new Map();
  const byTime = new Map();

  for (let si = 0; si < streams.length; si++) {
    const offset = streamOffsets[si];
    const steps = streams[si];
    for (let segi = 0; segi < steps.length; segi++) {
      const [x, y, d] = steps[segi];
      const gTime = offset + segi + 1;

      // gTime ≤ 1000, x ≤ 14, y ≤ 19 → key fits comfortably in a safe integer
      const ctKey = gTime * 1500 + x * 20 + y;
      let arr = byCellTime.get(ctKey);
      if (!arr) { arr = []; byCellTime.set(ctKey, arr); }
      arr.push({ si, segi, x, y, gTime });

      arr = byTime.get(gTime);
      if (!arr) { arr = []; byTime.set(gTime, arr); }
      arr.push({ si, segi, x, y, d });
    }
  }

  // pairCollisions: encoded(lo,hi) -> {gTime, pos, aSi, aSegi, bSi, bSegi}
  const pairCollisions = new Map();

  function tryCollision(gTime, pos, aSi, aSegi, bSi, bSegi) {
    const lo = Math.min(aSi, bSi), hi = Math.max(aSi, bSi);
    const key = lo * 1024 + hi;
    const existing = pairCollisions.get(key);
    if (!existing || gTime < existing.gTime) {
      pairCollisions.set(key, { gTime, pos, aSi, aSegi, bSi, bSegi });
    }
  }

  // 1. Same-cell same-time: any two beams from different streams at the same cell.
  for (const arrivals of byCellTime.values()) {
    if (arrivals.length < 2) continue;
    for (let i = 0; i < arrivals.length; i++) {
      for (let j = i + 1; j < arrivals.length; j++) {
        const a = arrivals[i], b = arrivals[j];
        if (a.si !== b.si) {
          tryCollision(a.gTime, [a.x, a.y], a.si, a.segi, b.si, b.segi);
        }
      }
    }
  }

  // 2. Crossing: at same gTime, A at P heading toward Q and B at Q heading toward P.
  for (const [gTime, arrivals] of byTime) {
    if (arrivals.length < 2) continue;
    for (let i = 0; i < arrivals.length; i++) {
      for (let j = i + 1; j < arrivals.length; j++) {
        const a = arrivals[i], b = arrivals[j];
        if (a.si === b.si) continue;
        if (a.d !== OPPOSITE[b.d]) continue;
        const [ddx, ddy] = DELTAS[a.d];
        if (b.x === a.x + ddx && b.y === a.y + ddy) {
          tryCollision(gTime, [(a.x + b.x) / 2, (a.y + b.y) / 2],
            a.si, a.segi, b.si, b.segi);
        }
      }
    }
  }

  // Apply truncations
  const truncations = new Map();
  const collisionPositions = [];
  for (const { pos, aSi, aSegi, bSi, bSegi } of pairCollisions.values()) {
    collisionPositions.push(pos);
    truncations.set(aSi, Math.min(truncations.has(aSi) ? truncations.get(aSi) : aSegi, aSegi));
    truncations.set(bSi, Math.min(truncations.has(bSi) ? truncations.get(bSi) : bSegi, bSegi));
  }
  for (const [si, maxSegi] of truncations) {
    streams[si] = streams[si].slice(0, maxSegi + 1);
  }
  return collisionPositions;
}

/**
 * Simulate a full laser path from scratch.
 * Returns { length, path, allCells, terminationReason }.
 *
 * @param {object} config - Puzzle configuration
 * @param {Array}  mirrors - [[x,y,type], ...]
 * @param {number} maxLength
 * @param {Set|null} obstacleSet - Set of posKey integers (pre-computed or null)
 * @param {Map|null} splitterMap - Map of posKey -> orientation string (or null)
 */
function simulateLaser(config, mirrors, maxLength = 1000, obstacleSet = null, splitterMap = null) {
  const mirrorMap = new Map();
  for (const [x, y, t] of mirrors) mirrorMap.set(posKey(x, y), t);

  if (!obstacleSet) {
    obstacleSet = new Set(config.obstacles.map(([x, y]) => posKey(x, y)));
  }
  if (!splitterMap) {
    splitterMap = new Map(
      (config.splitters || []).map(([x, y, o]) => [posKey(x, y), o])
    );
  }

  // DFS stack entries: [startX, startY, startDir, globalOffset]
  const stack = [[config.laserX, config.laserY, config.laserDir, 0]];
  const visited = new Set();
  const streams = [];
  const streamOffsets = [];

  let terminationReason = 'max_length';
  let totalSteps = 0;

  while (stack.length > 0 && totalSteps < maxLength) {
    const [startX, startY, startDir, globalOffset] = stack.pop();
    const streamSteps = [];
    let x = startX, y = startY, direction = startDir;

    while (totalSteps < maxLength) {
      const state = stateKey(x, y, direction);
      if (visited.has(state)) { terminationReason = 'loop'; break; }
      visited.add(state);

      const [dx, dy] = DELTAS[direction];
      const nx = x + dx, ny = y + dy;
      const step = [nx, ny, direction];

      if (nx < 0 || nx >= config.width || ny < 0 || ny >= config.height) {
        streamSteps.push(step); totalSteps++;
        terminationReason = 'edge'; break;
      }

      const nk = posKey(nx, ny);

      if (obstacleSet.has(nk)) {
        streamSteps.push(step); totalSteps++;
        terminationReason = 'obstacle'; break;
      }

      if (splitterMap.has(nk)) {
        const orientation = splitterMap.get(nk);
        const action = getSplitterAction(direction, orientation);
        streamSteps.push(step); totalSteps++;

        if (action === 'split') {
          const [dir1, dir2] = getSplitDirections(direction);
          const subOffset = globalOffset + streamSteps.length;
          stack.push([nx, ny, dir1, subOffset]);
          stack.push([nx, ny, dir2, subOffset]);
          break;
        } else if (action === 'wall') {
          terminationReason = 'obstacle'; break;
        } else { // reflect
          direction = OPPOSITE[dirFromString(orientation)];
          x = nx; y = ny; continue;
        }
      }

      streamSteps.push(step); totalSteps++;
      x = nx; y = ny;
      const k = posKey(x, y);
      if (mirrorMap.has(k)) direction = REFLECT[mirrorMap.get(k)][direction];
    }

    streams.push(streamSteps);
    streamOffsets.push(globalOffset);
  }

  resolveCollisions(streams, streamOffsets);

  const totalLength = streams.reduce((s, st) => s + st.length, 0);

  // Primary path (first stream only) — used by simulateIncremental
  const path = [[config.laserX, config.laserY, config.laserDir]];
  if (streams.length > 0) {
    for (const [nx, ny, incomingDir] of streams[0]) {
      const k = posKey(nx, ny);
      const dir = mirrorMap.has(k) ? REFLECT[mirrorMap.get(k)][incomingDir] : incomingDir;
      path.push([nx, ny, dir]);
    }
  }

  // allCells: every cell visited across all streams (for candidate generation)
  const allCells = new Set();
  for (const stream of streams)
    for (const [nx, ny] of stream) allCells.add(posKey(nx, ny));

  return { length: totalLength, path, allCells, terminationReason };
}

/**
 * Incremental simulation: add one mirror to an existing configuration.
 * If the mirror isn't on the existing path, returns the existing result unchanged.
 * Falls back to full simulateLaser when splitters are present.
 *
 * Returns { length, path, allCells, terminationReason }.
 */
function simulateIncremental(
  config, obstacleSet, existingMirrors, existingPath, existingLength,
  newMirror, maxLength = 1000, splitterMap = null, existingAllCells = null
) {
  if (!splitterMap) {
    splitterMap = new Map(
      (config.splitters || []).map(([x, y, o]) => [posKey(x, y), o])
    );
  }

  // Splitter puzzles: always use full simulation for correctness
  if (splitterMap.size > 0) {
    return simulateLaser(
      config, [...existingMirrors, newMirror], maxLength, obstacleSet, splitterMap
    );
  }

  const _existingAllCells = existingAllCells ||
    new Set(existingPath.map(([x, y]) => posKey(x, y)));

  const [mx, my, mtype] = newMirror;

  // Find if the new mirror appears on the existing path
  let mirrorIndex = null;
  for (let i = 0; i < existingPath.length; i++) {
    if (existingPath[i][0] === mx && existingPath[i][1] === my) {
      mirrorIndex = i; break;
    }
  }

  // Mirror not on path, or at laser source → no effect
  if (mirrorIndex === null || mirrorIndex === 0) {
    return { length: existingLength, path: existingPath,
             allCells: _existingAllCells, terminationReason: 'unchanged' };
  }

  const incomingDir = existingPath[mirrorIndex - 1][2];
  const newDir = REFLECT[mtype][incomingDir];
  const existingDirAtMirror = existingPath[mirrorIndex][2];

  // Mirror doesn't change direction → no effect
  if (newDir === existingDirAtMirror) {
    return { length: existingLength, path: existingPath,
             allCells: _existingAllCells, terminationReason: 'unchanged' };
  }

  // Build full mirror map (existing + new)
  const mirrorMap = new Map();
  for (const [x, y, t] of existingMirrors) mirrorMap.set(posKey(x, y), t);
  mirrorMap.set(posKey(mx, my), mtype);

  let x = mx, y = my;
  let direction = newDir;
  let length = mirrorIndex;

  const newPath = existingPath.slice(0, mirrorIndex);
  newPath.push([x, y, direction]);
  const visited = new Set(newPath.map(([px, py, pd]) => stateKey(px, py, pd)));

  while (length < maxLength) {
    const [dx, dy] = DELTAS[direction];
    const nx = x + dx, ny = y + dy;

    if (nx < 0 || nx >= config.width || ny < 0 || ny >= config.height) {
      length++;
      return {
        length, path: newPath,
        allCells: new Set(newPath.map(([px, py]) => posKey(px, py))),
        terminationReason: 'edge',
      };
    }
    if (obstacleSet.has(posKey(nx, ny))) {
      length++;
      return {
        length, path: newPath,
        allCells: new Set(newPath.map(([px, py]) => posKey(px, py))),
        terminationReason: 'obstacle',
      };
    }

    length++;
    x = nx; y = ny;
    const k = posKey(x, y);
    if (mirrorMap.has(k)) direction = REFLECT[mirrorMap.get(k)][direction];

    const state = stateKey(x, y, direction);
    if (visited.has(state)) {
      return {
        length, path: newPath,
        allCells: new Set(newPath.map(([px, py]) => posKey(px, py))),
        terminationReason: 'loop',
      };
    }
    visited.add(state);
    newPath.push([x, y, direction]);
  }

  return {
    length, path: newPath,
    allCells: new Set(newPath.map(([px, py]) => posKey(px, py))),
    terminationReason: 'max_length',
  };
}

/**
 * Return candidate [x,y] positions from allCells that aren't invalid or used.
 */
function getCandidatePositions(allCells, usedPositions, invalidPositions) {
  const positions = [];
  for (const pk of allCells) {
    if (!invalidPositions.has(pk) && !usedPositions.has(pk))
      positions.push(decodePos(pk));
  }
  return positions;
}

/**
 * Single-threaded beam search for exactly `targetDepth` mirrors.
 * Mirrors the Python beam_search_solver inner loop.
 *
 * @param {object} config
 * @param {number} targetDepth
 * @param {object} opts - { beamWidth, usePathPruning, obstacleSet, splitterMap,
 *                          invalidPositions, validPositions,
 *                          initialLength, initialPath, initialAllCells }
 * @returns {{ score: number, mirrors: Array }}
 */
function beamSearchForDepth(config, targetDepth, opts) {
  const {
    beamWidth = 2000,
    usePathPruning = true,
    obstacleSet,
    splitterMap,
    invalidPositions,
    validPositions,
    initialLength,
    initialPath,
    initialAllCells,
  } = opts;

  let bestScore = 0, bestMirrors = [];

  let candidates = [{
    mirrors: [],
    score: initialLength,
    path: initialPath,
    allCells: initialAllCells,
  }];

  for (let depth = 0; depth < targetDepth; depth++) {
    const nextCandidates = [];

    for (const candidate of candidates) {
      const usedPositions = new Set(candidate.mirrors.map(([x, y]) => posKey(x, y)));

      const positions = usePathPruning
        ? getCandidatePositions(candidate.allCells, usedPositions, invalidPositions)
        : validPositions.filter(([x, y]) => !usedPositions.has(posKey(x, y)));

      for (const [px, py] of positions) {
        for (const mtype of ['/', '\\']) {
          const newMirror = [px, py, mtype];
          const result = simulateIncremental(
            config, obstacleSet,
            candidate.mirrors, candidate.path, candidate.score,
            newMirror, 1000, splitterMap, candidate.allCells,
          );

          const newMirrors = [...candidate.mirrors, newMirror];
          if (result.length > bestScore) {
            bestScore = result.length;
            bestMirrors = newMirrors;
          }
          nextCandidates.push({
            mirrors: newMirrors,
            score: result.length,
            path: result.path,
            allCells: result.allCells,
          });
        }
      }
    }

    nextCandidates.sort((a, b) => b.score - a.score);
    candidates = nextCandidates.slice(0, beamWidth);
    if (candidates.length === 0) break;
  }

  return { score: bestScore, mirrors: bestMirrors };
}

module.exports = {
  UP, RIGHT, DOWN, LEFT,
  DELTAS, OPPOSITE, REFLECT,
  dirFromString, posKey, decodePos, stateKey,
  getSplitDirections, getSplitterAction,
  resolveCollisions,
  simulateLaser,
  simulateIncremental,
  getCandidatePositions,
  beamSearchForDepth,
};

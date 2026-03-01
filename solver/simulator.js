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

/**
 * Return 'split', 'wall', or 'reflect' for a laser hitting a directional splitter.
 *
 * - orientation: the direction a laser must travel to trigger a split
 * - laser traveling in orientation direction       → 'split' (emits perpendicular beams)
 * - laser traveling opposite to orientation        → 'wall'  (blocked)
 * - laser traveling perpendicular to orientation   → 'reflect' back toward opposite(orientation)
 */
function getSplitterAction(laserDir, orientation) {
  const orientDir = dirFromString(orientation);
  if (laserDir === orientDir) return 'split';
  if (laserDir === OPPOSITE[orientDir]) return 'wall';
  return 'reflect';
}

/**
 * Detect laser beam collisions and truncate streams in place.
 *
 * Two collision types are detected:
 *   1. Same-cell same-time: beams from different streams arrive at the same
 *      cell at the same global time, regardless of direction or cell content.
 *      This covers head-on, perpendicular, and same-direction beams — any two
 *      beams sharing the same point in space and time count as a collision.
 *   2. Crossing: at the same global time, beam A is at cell P heading toward Q
 *      and beam B is at Q heading toward P (adjacent cells, opposite directions).
 *
 * Per stream-pair, only the earliest collision is kept.  Both affected streams
 * are then truncated to include the collision step as the final step.
 *
 * Each step in a stream is [nx, ny, incomingDir] where:
 *   - (nx, ny) is the cell reached
 *   - incomingDir is the direction of travel used to reach that cell
 *   - global time for step i in stream s with offset o is: o + i + 1
 *
 * @param {Array[]} streams       Step lists; mutated in place on truncation.
 * @param {number[]} streamOffsets Global offset for each stream.
 * @returns {Array}               Collision positions as [x,y] or [x+0.5,y+0.5].
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
 *
 * Supports directional splitters and head-on beam collision detection.
 * When a splitter is hit with a matching direction, two sub-beams are pushed
 * onto a DFS stack and each simulated independently.  resolveCollisions() is
 * then called to truncate any streams that meet head-on or at the same cell
 * at the same global time, reducing the reported path length accordingly.
 *
 * @param {object}   config      Puzzle configuration.
 * @param {Array}    mirrors     [[x, y, type], …]
 * @param {number}   maxLength   Safety cap on total steps (default 1000).
 * @param {Set|null} obstacleSet Pre-computed Set of posKey integers (computed if null).
 * @param {Map|null} splitterMap Pre-computed Map of posKey → orientation (computed if null).
 * @returns {{ length, path, allCells, terminationReason }}
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
 * Simulate adding a single new mirror to an existing configuration.
 *
 * Optimization: if the new mirror is not on the existing path, it has no
 * effect and the existing result is returned unchanged.  If it is on the
 * path, only the portion from the mirror position onward is re-simulated.
 *
 * Falls back to full simulateLaser when splitters are present
 * (correctness takes priority over performance for splitter puzzles).
 *
 * @param {object}   config           Puzzle configuration.
 * @param {Set}      obstacleSet      Pre-computed Set of posKey integers.
 * @param {Array}    existingMirrors  Current mirror placements [[x,y,t], …].
 * @param {Array}    existingPath     Path from simulating existingMirrors.
 * @param {number}   existingLength   Length from simulating existingMirrors.
 * @param {Array}    newMirror        The new mirror to add [x, y, type].
 * @param {number}   maxLength        Safety cap (default 1000).
 * @param {Map|null} splitterMap      Pre-computed splitter map (computed if null).
 * @param {Set|null} existingAllCells All cells visited across all streams.
 * @returns {{ length, path, allCells, terminationReason }}
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
 * Get candidate [x,y] positions for mirror placement from all beam cells.
 * Only returns cells on any beam (primary or sub-beams) that are not already
 * occupied or otherwise invalid — mirrors placed elsewhere have no effect.
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
 * Optimisations (matching the Python implementation):
 *   - obstacleSet and splitterMap are pre-computed once, not per-simulation.
 *   - simulateIncremental: only re-simulates from the new mirror position.
 *   - Path pruning (usePathPruning): only considers cells on/adjacent to the
 *     current laser path, skipping positions that cannot affect the beam.
 *
 * Called by worker.js threads; solve.js parallelises across depth levels so
 * each worker runs this function for a single mirror count independently.
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

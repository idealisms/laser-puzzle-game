'use strict';
// Ported from simulator.py — pure functional laser path simulation.
// simulateLaser is an adapter over the shared src/game/engine/simulate.ts module.

const { calculateLaserPath } = require('../src/game/engine/simulate');

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

const INT_TO_DIR = ['up', 'right', 'down', 'left'];
const DIR_TO_INT = { up: UP, right: RIGHT, down: DOWN, left: LEFT };

function dirFromString(s) {
  return DIR_TO_INT[s];
}

// Encode (x, y) as a single integer. Grid is at most 15×20, so x*100+y is safe.
function posKey(x, y) { return x * 100 + y; }
function decodePos(k) { return [Math.floor(k / 100), k % 100]; }

// Encode (x, y, dir) for visited-state tracking.
function stateKey(x, y, dir) { return (x * 20 + y) * 4 + dir; }

/**
 * Simulate a full laser path from scratch.
 *
 * Adapter over calculateLaserPath from src/game/engine/simulate.ts.
 * Converts solver config format → frontend types, calls the shared implementation,
 * then extracts the solver format from the returned LaserPath.
 *
 * @param {object}   config      Puzzle configuration.
 * @param {Array}    mirrors     [[x, y, type], …]
 * @param {number}   maxLength   Safety cap (ignored — shared impl uses its own MAX_LASER_LENGTH).
 * @param {Set|null} obstacleSet Unused (kept for API compatibility with simulateIncremental).
 * @param {Map|null} splitterMap Unused (kept for API compatibility with simulateIncremental).
 * @returns {{ length, path, allCells, terminationReason }}
 */
function simulateLaser(config, mirrors, maxLength = 1000, obstacleSet = null, splitterMap = null) {
  // Convert mirrors from [[x,y,type]] to Mirror[]
  const mirrorObjs = mirrors.map(([x, y, type]) => ({ position: { x, y }, type }));

  // Convert config obstacles (plain walls) and splitters to Obstacle[]
  const wallObstacles = config.obstacles.map(([x, y]) => ({ x, y, type: 'wall' }));
  const splitterObstacles = (config.splitters || []).map(([x, y, o]) => ({
    x, y, type: 'splitter', orientation: o,
  }));
  const allObstacles = [...wallObstacles, ...splitterObstacles];

  // Convert laserDir from int to string
  const laserConfig = {
    x: config.laserX,
    y: config.laserY,
    direction: INT_TO_DIR[config.laserDir],
  };

  const bounds = { width: config.width, height: config.height };

  const laserPath = calculateLaserPath(laserConfig, mirrorObjs, allObstacles, bounds);

  // Map terminationReason to solver format
  const termMap = {
    'edge': 'edge',
    'obstacle': 'obstacle',
    'loop': 'loop',
    'max-length': 'max_length',
  };
  const terminationReason = termMap[laserPath.terminationReason];

  // Build primary path [[x,y,outgoingDir], …] starting with the laser source.
  // For each segment i: the cell is segment.end, and the outgoing direction is
  // segment[i+1].direction (next segment's incoming dir = current outgoing dir after
  // any mirror reflection), falling back to segment[i].direction for the last step.
  const stream0 = laserPath.streams[0];
  const path = [[config.laserX, config.laserY, config.laserDir]];
  if (stream0) {
    for (let i = 0; i < stream0.segments.length; i++) {
      const seg = stream0.segments[i];
      const nextSeg = stream0.segments[i + 1];
      const outgoingDirStr = nextSeg ? nextSeg.direction : seg.direction;
      path.push([seg.end.x, seg.end.y, DIR_TO_INT[outgoingDirStr]]);
    }
  }

  // allCells: every cell visited across all streams (for candidate generation)
  const allCells = new Set();
  for (const stream of laserPath.streams) {
    for (const seg of stream.segments) {
      allCells.add(posKey(seg.end.x, seg.end.y));
    }
  }

  return {
    length: laserPath.totalLength,
    path,
    allCells,
    terminationReason,
  };
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
 * Called by worker.ts threads; solve.ts parallelises across depth levels so
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
    beamWidth = 8000,
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
  simulateLaser,
  simulateIncremental,
  getCandidatePositions,
  beamSearchForDepth,
};

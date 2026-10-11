'use strict';
// simulateLaser is an adapter over the shared src/game/engine/simulate.ts module,
// used to verify solver results. The beam search scores with fastsim.ts.

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
 * then returns the total length and termination reason.
 *
 * @param {object}   config      Puzzle configuration.
 * @param {Array}    mirrors     [[x, y, type], …]
 * @returns {{ length, terminationReason }}
 */
function simulateLaser(config, mirrors) {
  // Convert mirrors from [[x,y,type]] to Mirror[]
  const mirrorObjs = mirrors.map(([x, y, type]) => ({ position: { x, y }, type }));

  // Convert config obstacles (plain walls), splitters, and gates to Obstacle[]
  const wallObstacles = config.obstacles.map(([x, y]) => ({ x, y, type: 'wall' }));
  const splitterObstacles = (config.splitters || []).map(([x, y, o]) => ({
    x, y, type: 'splitter', orientation: o,
  }));
  const gateObstacles = (config.gates || []).map(([x, y, o]) => ({
    x, y, type: 'gate', orientation: o,
  }));
  const allObstacles = [...wallObstacles, ...splitterObstacles, ...gateObstacles];

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

  return { length: laserPath.totalLength, terminationReason };
}

module.exports = {
  UP, RIGHT, DOWN, LEFT,
  DELTAS, OPPOSITE, REFLECT,
  dirFromString, posKey, decodePos, stateKey,
  simulateLaser,
};

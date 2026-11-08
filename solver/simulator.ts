'use strict';
// simulateLaser is an adapter over the shared src/game/engine/simulate.ts module,
// used to verify solver results. The beam search scores with fastsim.ts.

const { calculateLaserPath } = require('../src/game/engine/simulate');
const { configToObstacles } = require('./obstacles');

const INT_TO_DIR = ['up', 'right', 'down', 'left'];
const DIR_TO_INT = { up: 0, right: 1, down: 2, left: 3 };

function dirFromString(s) {
  return DIR_TO_INT[s];
}

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

  const allObstacles = configToObstacles(config);

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

module.exports = { dirFromString, simulateLaser };

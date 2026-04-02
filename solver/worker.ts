'use strict';
/**
 * Worker thread for parallel beam search.
 *
 * Receives workerData with:
 *   { configData, obstacleSetArr, splitterMapArr, invalidPosArr, validPositions,
 *     initialLength, initialPath, initialAllCellsArr, targetDepth, beamWidth, usePathPruning,
 *     useV2 }
 *
 * Posts back: { score, mirrors }
 */
const { workerData, parentPort } = require('worker_threads');
const { beamSearchForDepth, posKey } = require('./simulator');
const { beamSearchForDepth2 } = require('./simulator2');

const {
  configData,
  obstacleSetArr,
  splitterMapArr,
  gateMapArr,
  invalidPosArr,
  validPositions,
  initialLength,
  initialPath,
  initialAllCells,
  targetDepth,
  beamWidth,
  usePathPruning,
  useV2,
} = workerData;

// Reconstruct typed collections from serialised arrays
const obstacleSet = new Set(obstacleSetArr);
const splitterMap = new Map(splitterMapArr);
const gateMap = new Map((gateMapArr || []).map(([k, o]) => [k, { up: 0, right: 1, down: 2, left: 3 }[o]]));
const invalidPositions = new Set(invalidPosArr);

const searchOpts = {
  beamWidth,
  usePathPruning,
  obstacleSet,
  splitterMap,
  gateMap,
  invalidPositions,
  validPositions,
  initialLength,
  initialPath,
  initialAllCells,
};

const result = useV2
  ? beamSearchForDepth2(configData, targetDepth, searchOpts)
  : beamSearchForDepth(configData, targetDepth, searchOpts);

parentPort.postMessage(result);

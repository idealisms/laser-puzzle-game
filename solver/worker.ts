'use strict';
/**
 * Worker thread for parallel beam search.
 *
 * Receives workerData with:
 *   { configData, obstacleSetArr, splitterMapArr, invalidPosArr, validPositions,
 *     initialLength, initialPath, initialAllCellsArr, targetDepth, beamWidth, usePathPruning }
 *
 * Posts back: { score, mirrors }
 */
const { workerData, parentPort } = require('worker_threads');
const { beamSearchForDepth, posKey } = require('./simulator');

const {
  configData,
  obstacleSetArr,
  splitterMapArr,
  invalidPosArr,
  validPositions,
  initialLength,
  initialPath,
  initialAllCellsArr,
  targetDepth,
  beamWidth,
  usePathPruning,
} = workerData;

// Reconstruct typed collections from serialised arrays
const obstacleSet = new Set(obstacleSetArr);
const splitterMap = new Map(splitterMapArr);
const invalidPositions = new Set(invalidPosArr);
const initialAllCells = new Set(initialAllCellsArr);

const result = beamSearchForDepth(configData, targetDepth, {
  beamWidth,
  usePathPruning,
  obstacleSet,
  splitterMap,
  invalidPositions,
  validPositions,
  initialLength,
  initialPath,
  initialAllCells,
});

parentPort.postMessage(result);

'use strict';
/**
 * Worker thread for the --v2 search: runs beamSearchForDepth2 for one mirror depth.
 * (The default search uses beam_worker.ts instead.)
 *
 * Receives workerData with:
 *   { configData, obstacleSetArr, splitterMapArr, gateMapArr, invalidPosArr,
 *     targetDepth, beamWidth }
 *
 * Posts back: { score, mirrors }
 */
const { workerData, parentPort } = require('worker_threads');
const { beamSearchForDepth2 } = require('./simulator2');

const {
  configData,
  obstacleSetArr,
  splitterMapArr,
  gateMapArr,
  invalidPosArr,
  targetDepth,
  beamWidth,
} = workerData;

// Reconstruct typed collections from serialised arrays
const obstacleSet = new Set(obstacleSetArr);
const splitterMap = new Map(splitterMapArr);
const gateMap = new Map((gateMapArr || []).map(([k, o]) => [k, { up: 0, right: 1, down: 2, left: 3 }[o]]));
const invalidPositions = new Set(invalidPosArr);

const result = beamSearchForDepth2(configData, targetDepth, {
  beamWidth,
  obstacleSet,
  splitterMap,
  gateMap,
  invalidPositions,
});

parentPort.postMessage(result);

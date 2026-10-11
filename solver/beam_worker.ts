'use strict';
/**
 * Persistent worker for beam_search.ts.
 *
 * workerData: { config, usePathPruning }
 * Messages (each gets exactly one reply):
 *   { type: 'begin', childDepth, beamWidth }  → { type: 'ok' }
 *   { type: 'expand', parents, parentDepth }  → { type: 'ok' }
 *   { type: 'end' }                           → { scores, hashes, mirrors }
 */
const { workerData, parentPort } = require('worker_threads');
const { createExpander } = require('./beam_search');

const expander = createExpander(workerData.config, { usePathPruning: workerData.usePathPruning });

parentPort.on('message', (msg) => {
  if (msg.type === 'begin') {
    expander.begin(msg.childDepth, msg.beamWidth);
    parentPort.postMessage({ type: 'ok' });
  } else if (msg.type === 'expand') {
    expander.expand(msg.parents, msg.parentDepth);
    parentPort.postMessage({ type: 'ok' });
  } else if (msg.type === 'end') {
    const r = expander.end();
    parentPort.postMessage(r, [r.scores.buffer, r.hashes.buffer, r.mirrors.buffer]);
  }
});

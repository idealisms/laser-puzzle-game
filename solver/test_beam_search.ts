'use strict';
/**
 * Tests for beam_search.ts using an in-process worker pool.
 *
 * Run: node --require tsx/cjs --test test_beam_search.ts
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { beamSearch, createExpander } = require('./beam_search');
const { simulateLaser } = require('./simulator');
const { PUZZLES } = require('./puzzles');

/** A Pool whose "workers" are expanders running on this thread. */
function inProcessPool(config, size) {
  const expanders = Array.from({ length: size }, () => createExpander(config));
  return {
    size,
    async request(i, msg) {
      const e = expanders[i];
      if (msg.type === 'begin') return e.begin(msg.childDepth, msg.beamWidth);
      if (msg.type === 'expand') return e.expand(msg.parents, msg.parentDepth);
      return e.end();
    },
  };
}

const SPLITTER_PUZZLES = ['2026-03-19', '2026-04-07', '2026-10-19'];
const PLAIN_PUZZLES = ['2026-01-22'];

describe('beamSearch', () => {
  for (const date of [...SPLITTER_PUZZLES, ...PLAIN_PUZZLES]) {
    it(`${date}: result verifies and is independent of worker count`, async () => {
      const config = PUZZLES[date];
      const one = await beamSearch(config, inProcessPool(config, 1), { beamWidth: 100 });
      const three = await beamSearch(config, inProcessPool(config, 3), { beamWidth: 100 });
      assert.deepEqual(three, one);

      assert.ok(one.mirrors.length >= 1 && one.mirrors.length <= config.numMirrors);
      assert.equal(simulateLaser(config, one.mirrors).length, one.score);
      const cells = new Set(one.mirrors.map(([x, y]) => `${x},${y}`));
      assert.equal(cells.size, one.mirrors.length, 'mirrors must be on distinct cells');
    });
  }

  it('never places mirrors on obstacles, splitters, gates or the laser', async () => {
    for (const date of SPLITTER_PUZZLES) {
      const config = PUZZLES[date];
      const blocked = new Set([
        ...config.obstacles, ...config.splitters, ...config.gates, [config.laserX, config.laserY],
      ].map(([x, y]) => `${x},${y}`));
      const { mirrors } = await beamSearch(config, inProcessPool(config, 2), { beamWidth: 50 });
      for (const [x, y] of mirrors) assert.ok(!blocked.has(`${x},${y}`), `${date}: mirror on (${x},${y})`);
    }
  });
});

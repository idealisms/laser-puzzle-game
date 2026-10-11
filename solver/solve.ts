#!/usr/bin/env node
'use strict';
/**
 * Laser Puzzle Solver — Node.js parallel implementation
 *
 * Beam search (beam_search.ts): one beam over all depths, with each depth's
 * expansion split across a pool of worker threads. Handles splitters and gates.
 *
 * Usage:
 *   npx tsx solve.ts 2026-01-22 --beam-width 12000 --workers 12  # recommended (all puzzle types)
 *   npx tsx solve.ts --list                          # list puzzles
 *   npx tsx solve.ts 2026-01-22 --workers 1         # single-threaded
 *   npx tsx solve.ts 2026-01-22 --no-prune
 *   npx tsx solve.ts 2026-01-22 --quiet
 */

const path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');

const { PUZZLES } = require('./puzzles');
const { simulateLaser } = require('./simulator');
const { beamSearch } = require('./beam_search');

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    puzzle: null,
    list: false,
    quiet: false,
    beamWidth: 12000,
    noPrune: false,
    workers: os.cpus().length,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--list' || a === '-l') { opts.list = true; }
    else if (a === '--quiet' || a === '-q') { opts.quiet = true; }
    else if (a === '--no-prune') { opts.noPrune = true; }
    else if (a === '--beam-width') { opts.beamWidth = parseInt(args[++i], 10); }
    else if (a === '--workers') { opts.workers = parseInt(args[++i], 10); }
    else if (!a.startsWith('-')) { opts.puzzle = a; }
    else { console.error(`Unknown argument: ${a}`); process.exit(1); }
  }
  return opts;
}

// ── Layer-parallel beam search ────────────────────────────────────────────────

/**
 * Run beam_search.ts with a pool of persistent beam_worker.ts threads.
 * Workers split each depth's expansion between them, so all `numWorkers`
 * threads stay busy for the whole search.
 */
async function runLayerParallel(config, numWorkers, beamWidth, usePathPruning, onLayer = null) {
  const workers = Array.from({ length: Math.max(1, numWorkers) }, () =>
    new Worker(path.join(__dirname, 'beam_worker.ts'), {
      execArgv: ['--require', 'tsx/cjs'],
      workerData: { config, usePathPruning },
    }));

  // Each worker handles one request at a time, so replies arrive in order.
  const pending = workers.map(() => []);
  let failure = null;
  workers.forEach((w, i) => {
    w.on('message', (msg) => pending[i].shift().resolve(msg));
    w.on('error', (err) => {
      failure = err;
      for (const p of pending[i].splice(0)) p.reject(err);
    });
  });

  const pool = {
    size: workers.length,
    request(i, msg, transfer = []) {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        pending[i].push({ resolve, reject });
        workers[i].postMessage(msg, transfer);
      });
    },
  };

  try {
    return await beamSearch(config, pool, { beamWidth, onLayer });
  } finally {
    await Promise.all(workers.map((w) => w.terminate()));
  }
}

// ── Exported solver API ───────────────────────────────────────────────────────

/**
 * Solve a puzzle config and return { score, mirrors }.
 *
 * Runs the layer-parallel beam search (beam_search.ts), which handles every
 * puzzle type and keeps all `opts.workers` threads busy at every depth.
 *
 * @param {object} config  Puzzle config from PUZZLES (puzzles.ts).
 * @param {object} opts    { beamWidth?, workers?, noPrune?, onLayer? }
 * @returns {Promise<{ score: number, mirrors: Array }>}
 */
async function solvePuzzle(config, opts: any = {}) {
  const {
    beamWidth = 8000,
    workers = os.cpus().length,
    noPrune = false,
    onLayer = null,
  } = opts;

  return runLayerParallel(config, workers, beamWidth, !noPrune, onLayer);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.list) {
    console.log('Puzzles by date (15x20):');
    console.log('-'.repeat(60));
    for (const [date, cfg] of Object.entries(PUZZLES)) {
      console.log(`  ${date}: ${cfg.name} (${cfg.numMirrors} mirrors)`);
    }
    return 0;
  }

  if (!opts.puzzle) {
    console.log('Usage: npx tsx solve.ts <date> [options]');
    console.log('       npx tsx solve.ts --list');
    return 1;
  }

  const config = PUZZLES[opts.puzzle];
  if (!config) {
    console.error(`Error: unknown puzzle "${opts.puzzle}"`);
    return 1;
  }

  if (!opts.quiet) {
    console.log(`Puzzle: ${config.name}`);
    console.log(`Grid: ${config.width}x${config.height}`);
    console.log(`Mirrors available: ${config.numMirrors}`);
    console.log(`Obstacles: ${config.obstacles.length}`);
    const dirName = ['up','right','down','left'][config.laserDir];
    console.log(`Laser: (${config.laserX}, ${config.laserY}) -> ${dirName}`);
    const pruneStr = opts.noPrune ? ', no-prune' : '';
    console.log();
    console.log(`Solving with beam search (beam_width: ${opts.beamWidth}${pruneStr}, workers: ${opts.workers})...`);
  }

  const startTime = Date.now();
  const onLayer = opts.quiet ? null : ({ depth, beamCount, layerBest, bestScore, ms }) =>
    console.log(`  depth ${depth}: ${beamCount} states, layer best ${layerBest}, best ${bestScore} (${(ms / 1000).toFixed(1)}s)`);
  const result = await solvePuzzle(config, {
    beamWidth: opts.beamWidth, workers: opts.workers, noPrune: opts.noPrune, onLayer,
  });
  const elapsed = (Date.now() - startTime) / 1000;

  console.log();
  console.log('='.repeat(50));
  console.log('SOLUTION');
  console.log('='.repeat(50));
  console.log(`Path length: ${result.score}`);
  console.log(`Mirrors placed: ${result.mirrors.length}`);
  for (const [x, y, t] of result.mirrors) console.log(`  (${x}, ${y}) -> ${t}`);
  console.log(`Solve time: ${elapsed.toFixed(2)}s`);

  // Verify solution
  const verified = simulateLaser(config, result.mirrors);
  if (verified.length !== result.score) {
    console.error(`WARNING: Verification failed! Expected ${result.score}, got ${verified.length}`);
    return 1;
  }

  return 0;
}

module.exports = { solvePuzzle };

if (require.main === module) {
  main().then(code => process.exit(code)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

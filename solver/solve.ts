#!/usr/bin/env node
'use strict';
/**
 * Laser Puzzle Solver — Node.js parallel implementation
 *
 * Parallelises across mirror-count levels: each worker independently runs a
 * full beam search for its assigned mirror depth, mirroring the outer loop in
 * the Python solver.  The main thread picks the best result.
 *
 * Usage:
 *   npx tsx solve.ts 2026-01-22 --v2 --beam-width 12000 --workers 12  # recommended (no splitters)
 *   npx tsx solve.ts 2026-01-22 --beam-width 6000 --workers 12        # splitter puzzles
 *   npx tsx solve.ts --list                          # list puzzles
 *   npx tsx solve.ts 2026-01-22 --workers 1         # single-threaded
 *   npx tsx solve.ts 2026-01-22 --no-prune
 *   npx tsx solve.ts 2026-01-22 --quiet
 */

const path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');

const { PUZZLES } = require('./puzzles');
const { simulateLaser, posKey } = require('./simulator');
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
    v2: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--list' || a === '-l') { opts.list = true; }
    else if (a === '--quiet' || a === '-q') { opts.quiet = true; }
    else if (a === '--no-prune') { opts.noPrune = true; }
    else if (a === '--v2') { opts.v2 = true; }
    else if (a === '--beam-width') { opts.beamWidth = parseInt(args[++i], 10); }
    else if (a === '--workers') { opts.workers = parseInt(args[++i], 10); }
    else if (!a.startsWith('-')) { opts.puzzle = a; }
  }
  return opts;
}

// ── Worker pool ───────────────────────────────────────────────────────────────

/**
 * Run beam searches in parallel, one worker per mirror-count depth level.
 * Returns the best { score, mirrors } across all depths.
 */
function runParallel(config, sharedData, numMirrors, numWorkers, beamWidth, usePathPruning, useV2 = false) {
  return new Promise((resolve, reject) => {
    const depths = Array.from({ length: numMirrors }, (_, i) => i + 1);
    // Cap workers to avoid spawning more than needed
    const effectiveWorkers = Math.min(numWorkers, numMirrors);

    let bestScore = 0, bestMirrors = [];
    let completed = 0;
    let dispatched = 0;
    const errors = [];

    function spawnNext() {
      if (dispatched >= depths.length) return;
      const targetDepth = depths[dispatched++];

      const worker = new Worker(path.join(__dirname, 'worker.ts'), {
        execArgv: ['--require', 'tsx/cjs'],
        workerData: {
          configData: config,
          ...sharedData,
          targetDepth,
          beamWidth,
          usePathPruning,
          useV2,
        },
      });

      worker.on('message', ({ score, mirrors }) => {
        if (score > bestScore) {
          bestScore = score;
          bestMirrors = mirrors;
        }
      });

      worker.on('error', (err) => {
        errors.push(err);
      });

      worker.on('exit', () => {
        completed++;
        // Dispatch next depth if any remain
        spawnNext();
        if (completed === depths.length) {
          if (errors.length > 0) reject(errors[0]);
          else resolve({ score: bestScore, mirrors: bestMirrors });
        }
      });
    }

    // Seed the pool up to effectiveWorkers concurrent workers
    for (let i = 0; i < effectiveWorkers; i++) spawnNext();
  });
}

// ── Layer-parallel beam search (default; required for splitters/gates) ───────

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
 * Default: layer-parallel beam search (beam_search.ts), which handles every
 * puzzle type and keeps all `opts.workers` threads busy at every depth.
 *
 * With `v2`: segment-based search (simulator2.ts), parallelised across
 * mirror-count depth levels, one worker per depth.
 *
 * @param {object} config  Puzzle config from PUZZLES (puzzles.ts).
 * @param {object} opts    { beamWidth?, workers?, noPrune?, v2?, onLayer? }
 * @returns {Promise<{ score: number, mirrors: Array }>}
 */
async function solvePuzzle(config, opts: any = {}) {
  const {
    beamWidth = 8000,
    workers = os.cpus().length,
    noPrune = false,
    v2 = false,
    onLayer = null,
  } = opts;

  if (!v2) return runLayerParallel(config, workers, beamWidth, !noPrune, onLayer);

  // Pre-compute shared data (passed to all workers)
  const obstacleSet = new Set(config.obstacles.map(([x, y]) => posKey(x, y)));
  const splitterMap = new Map(
    (config.splitters || []).map(([x, y, o]) => [posKey(x, y), o])
  );
  const gateMap = new Map((config.gates || []).map(([x, y, o]) => [posKey(x, y), o]));
  const laserPos = posKey(config.laserX, config.laserY);
  const invalidPositions = new Set([...obstacleSet, ...splitterMap.keys(), ...gateMap.keys(), laserPos]);

  const validPositions = [];
  for (let x = 0; x < config.width; x++)
    for (let y = 0; y < config.height; y++)
      if (!invalidPositions.has(posKey(x, y))) validPositions.push([x, y]);

  const initial = simulateLaser(config, [], 1000, obstacleSet, splitterMap);

  const sharedData = {
    obstacleSetArr: [...obstacleSet],
    splitterMapArr: [...splitterMap.entries()],
    gateMapArr: [...gateMap.entries()],
    invalidPosArr: [...invalidPositions],
    validPositions,
    initialLength: initial.length,
    initialPath: initial.path,
    initialAllCells: initial.allCells,
  };

  return runParallel(
    config, sharedData,
    config.numMirrors, workers,
    beamWidth, !noPrune, v2,
  );
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
    const v2Str = opts.v2 ? ', v2' : '';
    console.log();
    console.log(`Solving with beam search (beam_width: ${opts.beamWidth}${pruneStr}${v2Str}, workers: ${opts.workers})...`);
  }

  const startTime = Date.now();
  const onLayer = opts.quiet ? null : ({ depth, beamCount, layerBest, bestScore, ms }) =>
    console.log(`  depth ${depth}: ${beamCount} states, layer best ${layerBest}, best ${bestScore} (${(ms / 1000).toFixed(1)}s)`);
  const result = await solvePuzzle(config, {
    beamWidth: opts.beamWidth, workers: opts.workers, noPrune: opts.noPrune, v2: opts.v2, onLayer,
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

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
 *   node solve.js 2026-01-22                     # solve with defaults
 *   node solve.js --list                          # list puzzles
 *   node solve.js 2026-01-22 --workers 1         # single-threaded
 *   node solve.js 2026-01-22 --beam-width 3000
 *   node solve.js 2026-01-22 --no-prune
 *   node solve.js 2026-01-22 --quiet
 */

const path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');

const { PUZZLES } = require('./puzzles.js');
const { simulateLaser, posKey } = require('./simulator.js');

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    puzzle: null,
    list: false,
    quiet: false,
    beamWidth: 2000,
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
  }
  return opts;
}

// ── Worker pool ───────────────────────────────────────────────────────────────

/**
 * Run beam searches in parallel, one worker per mirror-count depth level.
 * Returns the best { score, mirrors } across all depths.
 */
function runParallel(config, sharedData, numMirrors, numWorkers, beamWidth, usePathPruning) {
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

      const worker = new Worker(path.join(__dirname, 'worker.js'), {
        workerData: {
          configData: config,
          ...sharedData,
          targetDepth,
          beamWidth,
          usePathPruning,
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

// ── Exported solver API ───────────────────────────────────────────────────────

/**
 * Solve a puzzle config and return { score, mirrors }.
 * opts: { beamWidth, workers, noPrune }
 */
async function solvePuzzle(config, opts = {}) {
  const {
    beamWidth = 2000,
    workers = os.cpus().length,
    noPrune = false,
  } = opts;

  // Pre-compute shared data (passed to all workers)
  const obstacleSet = new Set(config.obstacles.map(([x, y]) => posKey(x, y)));
  const splitterMap = new Map(
    (config.splitters || []).map(([x, y, o]) => [posKey(x, y), o])
  );
  const laserPos = posKey(config.laserX, config.laserY);
  const invalidPositions = new Set([...obstacleSet, ...splitterMap.keys(), laserPos]);

  const validPositions = [];
  for (let x = 0; x < config.width; x++)
    for (let y = 0; y < config.height; y++)
      if (!invalidPositions.has(posKey(x, y))) validPositions.push([x, y]);

  const initial = simulateLaser(config, [], 1000, obstacleSet, splitterMap);

  const sharedData = {
    obstacleSetArr: [...obstacleSet],
    splitterMapArr: [...splitterMap.entries()],
    invalidPosArr: [...invalidPositions],
    validPositions,
    initialLength: initial.length,
    initialPath: initial.path,
    initialAllCellsArr: [...initial.allCells],
  };

  return runParallel(
    config, sharedData,
    config.numMirrors, workers,
    beamWidth, !noPrune,
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
    console.log('Usage: node solve.js <date> [options]');
    console.log('       node solve.js --list');
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

  // Pre-compute shared data (passed to all workers)
  const obstacleSet = new Set(config.obstacles.map(([x, y]) => posKey(x, y)));
  const splitterMap = new Map(
    (config.splitters || []).map(([x, y, o]) => [posKey(x, y), o])
  );
  const laserPos = posKey(config.laserX, config.laserY);
  const invalidPositions = new Set([...obstacleSet, ...splitterMap.keys(), laserPos]);

  const validPositions = [];
  for (let x = 0; x < config.width; x++)
    for (let y = 0; y < config.height; y++)
      if (!invalidPositions.has(posKey(x, y))) validPositions.push([x, y]);

  // Initial simulation (no mirrors)
  const initial = simulateLaser(config, [], 1000, obstacleSet, splitterMap);

  const sharedData = {
    obstacleSetArr: [...obstacleSet],
    splitterMapArr: [...splitterMap.entries()],
    invalidPosArr: [...invalidPositions],
    validPositions,
    initialLength: initial.length,
    initialPath: initial.path,
    initialAllCellsArr: [...initial.allCells],
  };

  const startTime = Date.now();
  const result = await runParallel(
    config, sharedData,
    config.numMirrors, opts.workers,
    opts.beamWidth, !opts.noPrune,
  );
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
  const verified = simulateLaser(config, result.mirrors, 1000, obstacleSet, splitterMap);
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

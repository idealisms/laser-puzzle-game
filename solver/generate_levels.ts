#!/usr/bin/env node
'use strict';
/**
 * Generate level JSON files for the laser puzzle game.
 * Computes optimal scores using beam search and outputs to solver/levels/
 *
 * Usage:
 *   npx tsx generate_levels.ts --date 2026-03-01           # Generate specific date
 *   npx tsx generate_levels.ts --start 2026-03-01 --end 2026-03-07  # Generate date range
 *   npx tsx generate_levels.ts --beam-width 2000 --workers 4  # Tuning options
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { PUZZLES } = require('./puzzles');
const { solvePuzzle } = require('./solve');

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_SPLITTERS = 2;

interface SolverOpts {
  beamWidth: number;
  workers: number;
}

interface PuzzleConfig {
  name: string;
  width: number;
  height: number;
  laserX: number;
  laserY: number;
  laserDir: number;
  obstacles: [number, number][];
  numMirrors: number;
  splitters?: [number, number, string][];
}

/**
 * Get the puzzle configuration for a given date.
 * Throws if no puzzle exists for that date.
 */
function getPuzzleForDate(dateStr: string): PuzzleConfig {
  if (!(dateStr in PUZZLES)) {
    throw new Error(
      `No puzzle configured for ${dateStr}. ` +
      'Add a new JSON file to solver/puzzles/ with this date.'
    );
  }
  return PUZZLES[dateStr];
}

/**
 * Generate a level for the given date using the provided puzzle config.
 * Returns the level object (same schema as Python generate_levels.py).
 */
async function generateLevel(dateStr: string, config: PuzzleConfig, solverOpts: SolverOpts) {
  const numSplitters = (config.splitters || []).length;
  if (numSplitters > MAX_SPLITTERS) {
    throw new Error(
      `${dateStr}: puzzle has ${numSplitters} splitters (max ${MAX_SPLITTERS}). ` +
      'Reduce the splitter count in solver/puzzles/ before generating.'
    );
  }

  console.log(`Computing optimal score for ${dateStr} (${config.name})...`);
  const result = await solvePuzzle(config, solverOpts);
  const optimalScore = result.score;
  const optimalMirrors = result.mirrors;
  console.log(`  Optimal score: ${optimalScore} (${optimalMirrors.length} mirrors)`);

  // Convert mirrors from [x, y, type] triples to JSON-serialisable format
  const optimalSolution = optimalMirrors.map(([x, y, type]) => ({ x, y, type }));

  const dirName = ['up', 'right', 'down', 'left'][config.laserDir];

  return {
    date: dateStr,
    gridWidth: config.width,
    gridHeight: config.height,
    laserConfig: {
      x: config.laserX,
      y: config.laserY,
      direction: dirName,
    },
    obstacles: [
      // Plain wall obstacles
      ...config.obstacles.map(([x, y]) => ({ x, y })),
      // Splitters (emitted after walls, matching Python order)
      ...(config.splitters || []).map(([x, y, orientation]) => ({
        x, y, type: 'splitter', orientation,
      })),
    ],
    mirrorsAvailable: config.numMirrors,
    optimalScore,
    optimalSolution,
  };
}

/**
 * Generate and save a level for a specific date.
 */
async function generateForDate(dateStr: string, outputDir: string, solverOpts: SolverOpts) {
  const config = getPuzzleForDate(dateStr);
  const level = await generateLevel(dateStr, config, solverOpts);

  const outputPath = path.join(outputDir, `${dateStr}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(level, null, 2));
  console.log(`  Saved to ${outputPath}`);
}

// ── Date utilities ────────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  const d = new Date(str + 'T00:00:00Z');
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${str}`);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const opts = {
    date: null as string | null,
    start: null as string | null,
    end: null as string | null,
    beamWidth: 8000,
    workers: os.cpus().length,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--date')        opts.date      = args[++i];
    else if (a === '--start')  opts.start     = args[++i];
    else if (a === '--end')    opts.end       = args[++i];
    else if (a === '--beam-width') opts.beamWidth = parseInt(args[++i], 10);
    else if (a === '--workers')    opts.workers   = parseInt(args[++i], 10);
    else { console.error(`Unknown argument: ${a}`); process.exit(1); }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);

  // Validate arguments (matches Python generate_levels.py behaviour)
  if (!opts.date && !(opts.start && opts.end)) {
    console.error('Error: must specify either --date or both --start and --end');
    process.exit(1);
  }
  if (opts.date && (opts.start || opts.end)) {
    console.error('Error: cannot use --date with --start/--end');
    process.exit(1);
  }
  if ((opts.start && !opts.end) || (opts.end && !opts.start)) {
    console.error('Error: must specify both --start and --end for range generation');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, 'levels');
  fs.mkdirSync(outputDir, { recursive: true });

  const solverOpts = { beamWidth: opts.beamWidth, workers: opts.workers };

  try {
    if (opts.start && opts.end) {
      // Generate date range
      let current = parseDate(opts.start);
      const end = parseDate(opts.end);
      while (current <= end) {
        await generateForDate(formatDate(current), outputDir, solverOpts);
        current = addDays(current, 1);
      }
    } else {
      // Generate single specific date
      await generateForDate(opts.date!, outputDir, solverOpts);
    }
    console.log('\nDone!');
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

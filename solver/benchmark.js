#!/usr/bin/env node
'use strict';
/**
 * Benchmark: Node.js single-threaded vs parallel solver.
 *
 * Runs two representative puzzles:
 *   - 2026-01-22  Chamber Grid  (10 mirrors, no splitters)
 *   - 2026-03-04  Chain Reaction (8 mirrors, 2 splitters)
 *
 * Usage:
 *   node benchmark.js [--runs N] [--beam-width W] [--workers N]
 */

const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const SOLVER_DIR = __dirname;

const BENCHMARKS = [
  { date: '2026-01-22', label: 'Chamber Grid       (10 mirrors, no splitters)' },
  { date: '2026-03-04', label: 'Chain Reaction     ( 8 mirrors, 2 splitters)' },
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { runs: 3, beamWidth: 2000, workers: os.cpus().length };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--runs') opts.runs = parseInt(args[++i], 10);
    else if (args[i] === '--beam-width') opts.beamWidth = parseInt(args[++i], 10);
    else if (args[i] === '--workers') opts.workers = parseInt(args[++i], 10);
  }
  return opts;
}

function runCommand(cmd, cwd) {
  const start = process.hrtime.bigint();
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd,
    encoding: 'utf8',
    timeout: 600_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status}):\n${result.stderr}`);
  }
  return { stdout: result.stdout, elapsedMs };
}

function extractScore(output) {
  const m = output.match(/Path length:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function bench(label, cmd, runs, cwd) {
  process.stdout.write(`  ${label}`);
  const times = [];
  let score = null;

  for (let i = 0; i < runs; i++) {
    try {
      const { stdout, elapsedMs } = runCommand(cmd, cwd);
      times.push(elapsedMs);
      if (score === null) score = extractScore(stdout);
      process.stdout.write('.');
    } catch (err) {
      process.stdout.write('E');
      console.error('\n   Error:', err.message.split('\n')[0]);
      return null;
    }
  }

  const med = median(times);
  const min = Math.min(...times);
  process.stdout.write(`\n    score=${score}  median=${(med/1000).toFixed(2)}s  min=${(min/1000).toFixed(2)}s\n`);
  return { score, medianMs: med, minMs: min };
}

async function main() {
  const opts = parseArgs(process.argv);

  console.log(`\nLaser Puzzle Solver Benchmark`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Runs per configuration: ${opts.runs}`);
  console.log(`Beam width: ${opts.beamWidth}`);
  console.log(`Workers: ${opts.workers} (of ${os.cpus().length} CPUs)`);
  console.log();

  const beamArg = String(opts.beamWidth);

  const summary = [];

  for (const { date, label } of BENCHMARKS) {
    console.log(`Puzzle: ${label}`);
    console.log(`Date:   ${date}`);
    console.log();

    const row = { date, label };

    // ── Node.js single-threaded (workers=1) ─────────────────────────────────
    {
      const r = bench(
        'tsx   solve.ts (workers=1)       ',
        ['npx', 'tsx', 'solve.ts', date, '--quiet', '--beam-width', beamArg, '--workers', '1'],
        opts.runs,
        SOLVER_DIR,
      );
      row.jsSingle = r;
    }

    // ── Node.js parallel ────────────────────────────────────────────────────
    {
      const r = bench(
        `tsx   solve.ts (workers=${String(opts.workers).padEnd(2)})       `,
        ['npx', 'tsx', 'solve.ts', date, '--quiet', '--beam-width', beamArg, '--workers', String(opts.workers)],
        opts.runs,
        SOLVER_DIR,
      );
      row.jsParallel = r;
    }

    summary.push(row);
    console.log();
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log('='.repeat(60));
  console.log('SUMMARY (median wall-clock times)');
  console.log('='.repeat(60));

  for (const row of summary) {
    console.log(`\n${row.label}`);
    const base = row.jsSingle ? row.jsSingle.medianMs : null;

    function fmtRow(name, r) {
      if (!r) return;
      const speedup = base ? `${(base / r.medianMs).toFixed(2)}x` : '—';
      const score = r.score ?? '?';
      console.log(
        `  ${name.padEnd(36)} score=${String(score).padEnd(6)} ${(r.medianMs/1000).toFixed(2)}s  (${speedup})`
      );
    }

    fmtRow('tsx solve.ts (workers=1)', row.jsSingle);
    fmtRow(`tsx solve.ts (workers=${opts.workers})`, row.jsParallel);
  }

  console.log();
}

main().catch(err => { console.error(err); process.exit(1); });

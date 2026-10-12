'use strict';
/**
 * Tries a splitter at every cell and orientation in a region and ranks the
 * placements by how well the optimal solution uses the beams out of every
 * splitter (see check_levels.ts). Use it when a puzzle's optimal solution
 * leaves one split beam with no mirrors.
 *
 * Usage (from solver/):
 *   npx tsx search_splitter.ts 2026-11-09 --splitter 1 --x 3-12 --y 11-16 [--dirs left,right,down]
 *       [--beam-width 4000] [--workers 12] [--top 8]
 *
 * --splitter is the index into the puzzle's "splitters" list (default 0).
 * Candidates are solved at a reduced beam width for speed; regenerate the
 * level at full width afterwards and re-run check_levels.ts, since ties at
 * full width can pick a different solution.
 */

const os = require('os');
const { PUZZLES } = require('./puzzles');
const { solvePuzzle } = require('./solve');
import { analyzeLevel, levelFromConfig, MIN_STREAM_LENGTH, MIN_STREAM_MIRRORS } from './check_levels';
import type { SplitterReport } from './check_levels';

export interface Candidate {
  x: number;
  y: number;
  dir: string;
  score: number;
  /** Length of the weakest beam out of any splitter; 0 if it places no mirror, -1 if a splitter never splits. */
  weakest: number;
  splitters: SplitterReport[];
}

/** Ranking key: every beam used beats any weak one, then the weakest beam's length, then score. */
export function rankCandidates(cands: Candidate[]): Candidate[] {
  return [...cands].sort((a, b) => b.weakest - a.weakest || b.score - a.score);
}

export function weakestStream(splitters: SplitterReport[]): number {
  let weakest = Infinity;
  for (const s of splitters) {
    if (s.streams.length < 2) return -1;
    for (const st of s.streams) weakest = Math.min(weakest, st.mirrors >= MIN_STREAM_MIRRORS ? st.length : 0);
  }
  return weakest === Infinity ? -1 : weakest;
}

export async function searchSplitter(config: any, index: number, xs: number[], ys: number[], dirs: string[],
  opts: { beamWidth: number; workers: number; onCandidate?: (c: Candidate) => void }): Promise<Candidate[]> {
  if (!config.splitters?.[index]) throw new Error(`puzzle has no splitter #${index}`);
  const taken = new Set([
    ...config.obstacles.map(([x, y]: number[]) => `${x},${y}`),
    ...config.splitters.filter((_: unknown, i: number) => i !== index).map(([x, y]: number[]) => `${x},${y}`),
    ...(config.gates || []).map(([x, y]: number[]) => `${x},${y}`),
    `${config.laserX},${config.laserY}`,
  ]);
  const results: Candidate[] = [];
  for (const x of xs) for (const y of ys) {
    if (taken.has(`${x},${y}`)) continue;
    for (const dir of dirs) {
      const splitters = config.splitters.map((s: unknown[], i: number) => (i === index ? [x, y, dir] : s));
      const candidate = { ...config, splitters };
      const { score, mirrors } = await solvePuzzle(candidate, { beamWidth: opts.beamWidth, workers: opts.workers });
      const report = analyzeLevel(levelFromConfig(candidate, mirrors)).splitters;
      const c = { x, y, dir, score, weakest: weakestStream(report), splitters: report };
      results.push(c);
      opts.onCandidate?.(c);
    }
  }
  return rankCandidates(results);
}

function range(spec: string): number[] {
  const [a, b = a] = spec.split('-').map(Number);
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < a) throw new Error(`bad range "${spec}"`);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const describe = (c: Candidate) =>
  `(${c.x},${c.y}) ${c.dir.padEnd(5)} score ${c.score}, weakest beam ${c.weakest}: ` +
  c.splitters.map(s => `(${s.x},${s.y}) ` + s.streams.map(st => `${st.direction} ${st.length}/${st.mirrors}m`).join(' ')).join('; ');

async function main(argv: string[]): Promise<number> {
  const opts = { date: '', index: 0, xs: [] as number[], ys: [] as number[], dirs: ['up', 'right', 'down', 'left'],
    beamWidth: 4000, workers: os.cpus().length, top: 8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--splitter') opts.index = Number(argv[++i]);
    else if (a === '--x') opts.xs = range(argv[++i]);
    else if (a === '--y') opts.ys = range(argv[++i]);
    else if (a === '--dirs') opts.dirs = argv[++i].split(',');
    else if (a === '--beam-width') opts.beamWidth = Number(argv[++i]);
    else if (a === '--workers') opts.workers = Number(argv[++i]);
    else if (a === '--top') opts.top = Number(argv[++i]);
    else if (!opts.date && !a.startsWith('--')) opts.date = a;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!opts.date || !opts.xs.length || !opts.ys.length) {
    console.error('Usage: npx tsx search_splitter.ts <date> --x <a-b> --y <a-b> [--splitter N] [--dirs up,right,down,left] ' +
      '[--beam-width 4000] [--workers N] [--top 8]');
    return 1;
  }
  const config = PUZZLES[opts.date];
  if (!config) throw new Error(`unknown puzzle "${opts.date}"`);
  const bad = opts.dirs.filter(d => !['up', 'right', 'down', 'left'].includes(d));
  if (bad.length) throw new Error(`bad direction(s): ${bad.join(', ')}`);

  console.log(`${opts.date} (${config.name}): moving splitter #${opts.index}; a beam counts as used with ` +
    `>= ${MIN_STREAM_MIRRORS} mirror and >= ${MIN_STREAM_LENGTH} cells`);
  const ranked = await searchSplitter(config, opts.index, opts.xs, opts.ys, opts.dirs, {
    beamWidth: opts.beamWidth, workers: opts.workers, onCandidate: c => console.log(`  ${describe(c)}`),
  });
  console.log(`\nBest ${Math.min(opts.top, ranked.length)}:`);
  for (const c of ranked.slice(0, opts.top)) console.log(`  ${describe(c)}`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => process.exit(code)).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

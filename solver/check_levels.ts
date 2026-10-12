'use strict';
/**
 * Checks generated levels (solver/levels/*.json) for splitter and gate
 * problems, and draws each optimal solution as ASCII.
 *
 * Usage (from solver/):
 *   npx tsx check_levels.ts 2026-11-01 [more dates...]
 *   npx tsx check_levels.ts --start 2026-11-01 --end 2026-11-15 [--quiet]
 *
 * Problems (exit code 1):
 *   - a splitter the optimal path never splits at, or a beam out of a split
 *     (with everything it later splits into) that places no mirror or runs
 *     fewer than MIN_STREAM_LENGTH cells. Puzzles are more fun when both
 *     beams out of a splitter matter.
 *   - a one-way gate whose entrance or exit cell is a wall, a splitter or
 *     off the grid: no beam can ever pass it, so it is just a wall.
 * A gate the optimal path doesn't pass is fine: it may block a better path.
 */

const fs = require('fs');
const path = require('path');
import { calculateLaserPath } from '../src/game/engine/simulate';
import type { Direction, LaserPath, LaserStream, MirrorType, Obstacle } from '../src/game/types';

export const MIN_STREAM_MIRRORS = 1;
export const MIN_STREAM_LENGTH = 8;

export interface Level {
  gridWidth: number;
  gridHeight: number;
  laserConfig: { x: number; y: number; direction: Direction };
  obstacles: Obstacle[];
  optimalSolution: { x: number; y: number; type: MirrorType }[];
}

export interface StreamReport { direction: Direction; length: number; mirrors: number }
export interface SplitterReport { x: number; y: number; orientation: Direction; streams: StreamReport[]; ok: boolean }
export interface GateReport { x: number; y: number; orientation: Direction; passes: number; entranceOpen: boolean; exitOpen: boolean }

const DELTA: Record<Direction, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const key = (x: number, y: number) => `${x},${y}`;

/** A level-shaped object for a solver config (puzzles.ts) and [x, y, type] mirrors. */
export function levelFromConfig(config: any, mirrors: [number, number, MirrorType][]): Level {
  const dirs: Direction[] = ['up', 'right', 'down', 'left'];
  return {
    gridWidth: config.width,
    gridHeight: config.height,
    laserConfig: { x: config.laserX, y: config.laserY, direction: dirs[config.laserDir] },
    obstacles: [
      ...config.obstacles.map(([x, y]: [number, number]) => ({ x, y })),
      ...(config.splitters || []).map(([x, y, o]: [number, number, Direction]) => ({ x, y, type: 'splitter', orientation: o })),
      ...(config.gates || []).map(([x, y, o]: [number, number, Direction]) => ({ x, y, type: 'gate', orientation: o })),
    ],
    optimalSolution: mirrors.map(([x, y, type]) => ({ x, y, type })),
  };
}

export function tracePath(level: Level): LaserPath {
  const mirrors = level.optimalSolution.map(m => ({ position: { x: m.x, y: m.y }, type: m.type }));
  return calculateLaserPath(level.laserConfig, mirrors, level.obstacles,
    { width: level.gridWidth, height: level.gridHeight });
}

export function analyzeLevel(level: Level, laserPath: LaserPath = tracePath(level)) {
  const mirrorCells = new Set(level.optimalSolution.map(m => key(m.x, m.y)));

  // Streams that a stream splits into at its last cell.
  const childrenOf = (st: LaserStream) => {
    const end = st.segments[st.segments.length - 1].end;
    const t = (st.globalOffset ?? 0) + st.segments.length;
    return laserPath.streams.filter(c => c.generation === st.generation + 1 && c.globalOffset === t &&
      c.segments[0].start.x === end.x && c.segments[0].start.y === end.y);
  };
  // Length and distinct mirrors of a stream plus everything it splits into.
  const measure = (st: LaserStream, mirrors: Set<string>): number => {
    let length = st.segments.length;
    for (const s of st.segments) if (mirrorCells.has(key(s.end.x, s.end.y))) mirrors.add(key(s.end.x, s.end.y));
    for (const c of childrenOf(st)) length += measure(c, mirrors);
    return length;
  };

  const splitters: SplitterReport[] = level.obstacles.filter(o => o.type === 'splitter').map(o => {
    const streams = laserPath.streams
      .filter(st => st.generation > 0 && st.segments[0].start.x === o.x && st.segments[0].start.y === o.y)
      .map(st => {
        const mirrors = new Set<string>();
        const length = measure(st, mirrors);
        return { direction: st.segments[0].direction, length, mirrors: mirrors.size };
      });
    const ok = streams.length >= 2 &&
      streams.every(s => s.mirrors >= MIN_STREAM_MIRRORS && s.length >= MIN_STREAM_LENGTH);
    return { x: o.x, y: o.y, orientation: o.orientation ?? 'right', streams, ok };
  });

  const blocked = new Set(level.obstacles.filter(o => o.type !== 'gate').map(o => key(o.x, o.y)));
  const open = (x: number, y: number) =>
    x >= 0 && x < level.gridWidth && y >= 0 && y < level.gridHeight && !blocked.has(key(x, y));
  const gates: GateReport[] = level.obstacles.filter(o => o.type === 'gate').map(o => {
    const orientation = o.orientation ?? 'right';
    const [dx, dy] = DELTA[orientation];
    const passes = laserPath.streams.flatMap(st => st.segments)
      .filter(s => s.end.x === o.x && s.end.y === o.y && s.direction === orientation).length;
    return { x: o.x, y: o.y, orientation, passes, entranceOpen: open(o.x - dx, o.y - dy), exitOpen: open(o.x + dx, o.y + dy) };
  });

  const problems = [
    ...splitters.filter(s => !s.ok).map(s => s.streams.length < 2
      ? `splitter (${s.x},${s.y}) never splits`
      : `splitter (${s.x},${s.y}) has a weak beam: ` + s.streams.map(st => `${st.direction} ${st.length} cells/${st.mirrors} mirrors`).join(', ')),
    ...gates.filter(g => !g.entranceOpen || !g.exitOpen).map(g =>
      `gate (${g.x},${g.y}) ${g.orientation} can never be passed: its ${!g.entranceOpen ? 'entrance' : 'exit'} is blocked`),
  ];
  return { splitters, gates, problems };
}

/** The optimal path drawn over the grid: '-' '|' beam, '+' crossing, '/' '\' mirrors. */
export function renderSolution(level: Level, laserPath: LaserPath = tracePath(level)): string {
  const grid = Array.from({ length: level.gridHeight }, () => Array(level.gridWidth).fill(' '));
  for (const st of laserPath.streams) for (const s of st.segments) {
    const { x, y } = s.end;
    if (x < 0 || y < 0 || x >= level.gridWidth || y >= level.gridHeight) continue;
    const c = s.direction === 'left' || s.direction === 'right' ? '-' : '|';
    grid[y][x] = grid[y][x] === ' ' || grid[y][x] === c ? c : '+';
  }
  const splitterChar = { up: '^', right: '>', down: 'v', left: '<' };
  const gateChar = { up: 'N', right: 'E', down: 'S', left: 'W' };
  for (const o of level.obstacles) {
    const orientation = o.orientation ?? 'right';
    grid[o.y][o.x] = o.type === 'splitter' ? splitterChar[orientation] : o.type === 'gate' ? gateChar[orientation] : '#';
  }
  for (const m of level.optimalSolution) grid[m.y][m.x] = m.type;
  grid[level.laserConfig.y][level.laserConfig.x] = '@';
  return grid.map((r, y) => `${String(y).padStart(2)} ${r.join('')}`).join('\n');
}

function datesFrom(args: string[]): { dates: string[]; quiet: boolean } {
  const dates: string[] = [];
  let start: string | null = null, end: string | null = null, quiet = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start') start = args[++i];
    else if (args[i] === '--end') end = args[++i];
    else if (args[i] === '--quiet') quiet = true;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(args[i])) dates.push(args[i]);
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  if (start || end) {
    if (!start || !end) throw new Error('--start and --end go together');
    for (let d = new Date(start + 'T00:00:00Z'); d <= new Date(end + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return { dates, quiet };
}

function main(argv: string[]): number {
  const { dates, quiet } = datesFrom(argv);
  if (!dates.length) {
    console.error('Usage: npx tsx check_levels.ts <date>... | --start <date> --end <date> [--quiet]');
    return 1;
  }
  let failed = 0;
  for (const date of dates) {
    const level: Level & { optimalScore: number } =
      JSON.parse(fs.readFileSync(path.join(__dirname, 'levels', `${date}.json`), 'utf8'));
    const laserPath = tracePath(level);
    const { splitters, gates, problems } = analyzeLevel(level, laserPath);
    console.log(`\n${date}: score ${level.optimalScore}, ${level.optimalSolution.length} mirrors`);
    if (!quiet) console.log(renderSolution(level, laserPath));
    for (const s of splitters) {
      const streams = s.streams.map(st => `${st.direction} ${st.length} cells/${st.mirrors} mirrors`).join(', ');
      console.log(`  splitter (${s.x},${s.y}) ${s.orientation}: ${streams || 'never splits'}`);
    }
    for (const g of gates) console.log(`  gate (${g.x},${g.y}) ${g.orientation}: passed ${g.passes}x`);
    for (const p of problems) console.log(`  PROBLEM: ${p}`);
    if (problems.length) failed++;
  }
  if (failed) console.log(`\n${failed} of ${dates.length} levels have problems`);
  return failed ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

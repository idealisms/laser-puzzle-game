'use strict';
/**
 * ASCII maps for drafting puzzles: convert a map to a solver/puzzles/*.json
 * config, or print an existing puzzle as a map to edit.
 *
 * Usage (from solver/):
 *   npx tsx puzzle_map.ts build drafts/2026-11-01.txt [more maps...]   # writes puzzles/DATE.json
 *   npx tsx puzzle_map.ts show 2026-10-23                             # prints the puzzle as a map
 *
 * Map format: header lines, then one line per grid row.
 *
 *   name: Fork Road
 *   date: 2026-11-01            (optional; defaults to the map's file name)
 *   size: 15x20                 (optional; default 15x20)
 *   laser: right                (direction; the laser cell is '@')
 *   mirrors: 9
 *   label a: north post         (label for obstacle group 'a'; '#' and a-z except v are groups)
 *   note 7,9: splits UP/DOWN    (note on the splitter or gate at x,y)
 *   notes: free text            (top-level puzzle notes; repeat for more lines)
 *   .....a.........
 *   ...
 *
 * Cells: '.' empty, '#' or a-z except v: wall (one obstacle group per character),
 * '@' laser, '^' '>' 'v' '<' splitter triggered by a beam travelling that
 * way, 'N' 'E' 'S' 'W' one-way gate passing up/right/down/left.
 */

const fs = require('fs');
const path = require('path');

const SPLITTER_CHARS: Record<string, string> = { '^': 'up', '>': 'right', 'v': 'down', '<': 'left' };
const GATE_CHARS: Record<string, string> = { N: 'up', E: 'right', S: 'down', W: 'left' };
// Every lowercase letter but 'v', which is a splitter.
const GROUP_CHARS = 'abcdefghijklmnopqrstuwxyz#';

interface Device { x: number; y: number; dir: string; note?: string }

export interface PuzzleJson {
  date: string;
  name: string;
  width: number;
  height: number;
  laser: { x: number; y: number; dir: string };
  num_mirrors: number;
  obstacle_groups: { label: string; cells: [number, number][] }[];
  splitters: Device[];
  gates: Device[];
  notes?: string[];
}

const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));

/** Parses an ASCII map. `defaultDate` is used when the map has no `date:` line. */
export function parseMap(text: string, defaultDate?: string): PuzzleJson {
  const meta: Record<string, string> = {};
  const labels: Record<string, string> = {};
  const deviceNotes = new Map<string, string>();
  const notes: string[] = [];
  const rows: string[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let m;
    if (rows.length === 0 && (m = line.match(/^label (\S): (.*)$/))) labels[m[1]] = m[2];
    else if (rows.length === 0 && (m = line.match(/^note (\d+),(\d+): (.*)$/))) deviceNotes.set(`${m[1]},${m[2]}`, m[3]);
    else if (rows.length === 0 && (m = line.match(/^notes: (.*)$/))) notes.push(m[1]);
    else if (rows.length === 0 && (m = line.match(/^(name|date|size|laser|mirrors): (.*)$/))) meta[m[1]] = m[2].trim();
    else rows.push(line.trim());
  }

  const [width, height] = (meta.size ?? '15x20').split('x').map(Number);
  const date = meta.date ?? defaultDate;
  for (const key of ['name', 'laser', 'mirrors']) if (!meta[key]) throw new Error(`map is missing "${key}:"`);
  if (!date) throw new Error('map is missing "date:" and no default date was given');
  if (!['up', 'right', 'down', 'left'].includes(meta.laser)) throw new Error(`bad laser direction "${meta.laser}"`);
  if (rows.length !== height) throw new Error(`expected ${height} rows, got ${rows.length}`);

  const groups = new Map<string, [number, number][]>();
  const splitters: Device[] = [], gates: Device[] = [];
  let laser: { x: number; y: number } | null = null;
  const device = (x: number, y: number, dir: string): Device => {
    const note = deviceNotes.get(`${x},${y}`);
    deviceNotes.delete(`${x},${y}`);
    return note === undefined ? { x, y, dir } : { x, y, dir, note };
  };

  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`row ${y} has ${row.length} cells, expected ${width}: "${row}"`);
    [...row].forEach((c, x) => {
      if (c === '.') return;
      if (c === '@') {
        if (laser) throw new Error(`second laser at (${x},${y})`);
        laser = { x, y };
      } else if (c in SPLITTER_CHARS) splitters.push(device(x, y, SPLITTER_CHARS[c]));
      else if (c in GATE_CHARS) gates.push(device(x, y, GATE_CHARS[c]));
      else if (GROUP_CHARS.includes(c)) {
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push([x, y]);
      } else throw new Error(`unknown cell "${c}" at (${x},${y})`);
    });
  });
  if (!laser) throw new Error('map has no laser ("@")');
  if (deviceNotes.size) throw new Error(`notes on cells with no splitter or gate: ${[...deviceNotes.keys()].join(' ')}`);
  for (const k of Object.keys(labels)) if (!groups.has(k)) throw new Error(`label for unused group "${k}"`);

  const { x, y } = laser as { x: number; y: number };
  const puzzle: PuzzleJson = {
    date,
    name: meta.name,
    width,
    height,
    laser: { x, y, dir: meta.laser },
    num_mirrors: Number(meta.mirrors),
    obstacle_groups: [...groups].map(([k, cells]) => ({ label: labels[k] ?? (k === '#' ? 'walls' : k), cells })),
    splitters,
    gates,
  };
  if (notes.length) puzzle.notes = notes;
  return puzzle;
}

/**
 * Prints a puzzle config as a map. A cell listed in more than one group goes
 * to the first; a group left with no cells is dropped. A wall under the laser
 * (only 2026-02-04 has one) is lost, since the cell can only show '@'.
 */
export function puzzleToMap(p: PuzzleJson): string {
  const grid = Array.from({ length: p.height }, () => Array(p.width).fill('.'));
  const header = [`name: ${p.name}`, `date: ${p.date}`];
  if (p.width !== 15 || p.height !== 20) header.push(`size: ${p.width}x${p.height}`);
  header.push(`laser: ${p.laser.dir}`, `mirrors: ${p.num_mirrors}`);

  let next = 0;
  for (const g of p.obstacle_groups) {
    const free = g.cells.filter(([x, y]) => grid[y][x] === '.');
    if (!free.length) continue;
    if (next >= GROUP_CHARS.length) throw new Error(`${p.date}: more than ${GROUP_CHARS.length} obstacle groups`);
    const c = GROUP_CHARS[next++];
    for (const [x, y] of free) grid[y][x] = c;
    header.push(`label ${c}: ${g.label}`);
  }
  const splitterChar = invert(SPLITTER_CHARS), gateChar = invert(GATE_CHARS);
  for (const [list, chars] of [[p.splitters ?? [], splitterChar], [p.gates ?? [], gateChar]] as const) {
    for (const d of list) {
      grid[d.y][d.x] = chars[d.dir];
      if (d.note !== undefined) header.push(`note ${d.x},${d.y}: ${d.note}`);
    }
  }
  for (const n of p.notes ?? []) header.push(`notes: ${n}`);
  grid[p.laser.y][p.laser.x] = '@';
  return [...header, ...grid.map(r => r.join(''))].join('\n') + '\n';
}

/** JSON for solver/puzzles/, with each cell on one line. */
export function formatPuzzleJson(p: PuzzleJson): string {
  return JSON.stringify(p, null, 2).replace(/\[\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2]') + '\n';
}

function main(argv: string[]): number {
  const [cmd, ...args] = argv;
  const puzzlesDir = path.join(__dirname, 'puzzles');
  if (cmd === 'build' && args.length) {
    for (const file of args) {
      const puzzle = parseMap(fs.readFileSync(file, 'utf8'), path.basename(file).replace(/\.[^.]*$/, ''));
      const out = path.join(puzzlesDir, `${puzzle.date}.json`);
      fs.writeFileSync(out, formatPuzzleJson(puzzle));
      console.log(`${file} -> ${path.relative(process.cwd(), out)}`);
    }
    return 0;
  }
  if (cmd === 'show' && args.length === 1) {
    process.stdout.write(puzzleToMap(JSON.parse(fs.readFileSync(path.join(puzzlesDir, `${args[0]}.json`), 'utf8'))));
    return 0;
  }
  console.error('Usage: npx tsx puzzle_map.ts build <map.txt>...\n       npx tsx puzzle_map.ts show <date>');
  return 1;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

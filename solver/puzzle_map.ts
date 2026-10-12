'use strict';
/**
 * The puzzle map format: solver/puzzles/YYYY-MM-DD.txt holds each puzzle as
 * header lines followed by one line per grid row. The date comes from the
 * file name.
 *
 *   name: Fork Road
 *   size: 15x20                 (optional; default 15x20)
 *   laser: right                (direction; the laser cell is '@')
 *   mirrors: 9
 *   label a: north post         (label for obstacle group 'a'; '#' and a-z except v are groups)
 *   note 7,9: splits UP/DOWN    (note on the splitter or gate at x,y)
 *   notes: free text            (puzzle notes; repeat for more lines)
 *   .....a.........
 *   ...
 *
 * Cells: '.' empty, '#' or a-z except v: wall (one obstacle group per character),
 * '@' laser, '^' '>' 'v' '<' splitter triggered by a beam travelling that
 * way, 'N' 'E' 'S' 'W' one-way gate passing up/right/down/left.
 */

const SPLITTER_CHARS: Record<string, string> = { '^': 'up', '>': 'right', 'v': 'down', '<': 'left' };
const GATE_CHARS: Record<string, string> = { N: 'up', E: 'right', S: 'down', W: 'left' };
// Every lowercase letter but 'v', which is a splitter.
const GROUP_CHARS = 'abcdefghijklmnopqrstuwxyz#';

interface Device { x: number; y: number; dir: string; note?: string }

export interface Puzzle {
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

/** Parses a puzzle map; `date` comes from its file name. */
export function parseMap(text: string, date: string): Puzzle {
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
    else if (rows.length === 0 && (m = line.match(/^(name|size|laser|mirrors): (.*)$/))) meta[m[1]] = m[2].trim();
    else rows.push(line.trim());
  }

  const [width, height] = (meta.size ?? '15x20').split('x').map(Number);
  for (const key of ['name', 'laser', 'mirrors']) if (!meta[key]) throw new Error(`map is missing "${key}:"`);
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
  const puzzle: Puzzle = {
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
 * Prints a puzzle as a map (without its date). A cell listed in more than one
 * group goes to the first; a group left with no cells is dropped. A wall
 * under the laser would be lost, since the cell can only show '@'.
 */
export function puzzleToMap(p: Puzzle): string {
  const grid = Array.from({ length: p.height }, () => Array(p.width).fill('.'));
  const header = [`name: ${p.name}`];
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

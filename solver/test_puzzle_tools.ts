'use strict';
/**
 * Tests for the puzzle design tools: puzzle_map.ts, check_levels.ts and
 * search_splitter.ts.
 *
 * Run with:
 *   cd solver && node --require tsx/cjs --test test_puzzle_tools.ts
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseMap, puzzleToMap, formatPuzzleJson } = require('./puzzle_map');
const { analyzeLevel, levelFromConfig, renderSolution } = require('./check_levels');
const { rankCandidates, searchSplitter, weakestStream } = require('./search_splitter');

const EMPTY_ROW = '.'.repeat(15);

/** A 15x20 map with `cells` ([x, y, char]) drawn on an empty grid. */
function map(header: string[], cells: [number, number, string][]) {
  const rows = Array.from({ length: 20 }, () => [...EMPTY_ROW]);
  for (const [x, y, c] of cells) rows[y][x] = c;
  return [...header, ...rows.map(r => r.join(''))].join('\n');
}

const HEADER = ['name: Test', 'laser: right', 'mirrors: 9'];

describe('parseMap', () => {
  it('reads the header, walls, splitters, gates and notes', () => {
    const p = parseMap(map([...HEADER, 'label a: post', 'note 7,9: splits', 'notes: hello'], [
      [0, 9, '@'], [3, 0, 'a'], [3, 1, 'a'], [5, 5, '#'], [7, 9, '>'], [10, 4, 'N'],
    ]), '2026-12-01');
    assert.deepEqual(p, {
      date: '2026-12-01',
      name: 'Test',
      width: 15,
      height: 20,
      laser: { x: 0, y: 9, dir: 'right' },
      num_mirrors: 9,
      obstacle_groups: [
        { label: 'post', cells: [[3, 0], [3, 1]] },
        { label: 'walls', cells: [[5, 5]] },
      ],
      splitters: [{ x: 7, y: 9, dir: 'right', note: 'splits' }],
      gates: [{ x: 10, y: 4, dir: 'up' }],
      notes: ['hello'],
    });
  });

  it("reads 'v' as a down splitter, not an obstacle group", () => {
    const p = parseMap(map(HEADER, [[0, 0, '@'], [4, 4, 'v']]), '2026-12-01');
    assert.deepEqual(p.splitters, [{ x: 4, y: 4, dir: 'down' }]);
    assert.deepEqual(p.obstacle_groups, []);
  });

  it('prefers a date: line over the default date', () => {
    assert.equal(parseMap(map([...HEADER, 'date: 2026-12-02'], [[0, 0, '@']]), '2026-12-01').date, '2026-12-02');
  });

  it('rejects malformed maps', () => {
    const bad = (text: string, message: RegExp) => assert.throws(() => parseMap(text, '2026-12-01'), message);
    bad(map(HEADER, []), /no laser/);
    bad(map(HEADER, [[0, 0, '@'], [1, 0, '@']]), /second laser/);
    bad(map(HEADER, [[0, 0, '@'], [1, 0, '?']]), /unknown cell "\?" at \(1,0\)/);
    bad(map([...HEADER, 'note 4,4: nothing here'], [[0, 0, '@']]), /notes on cells with no splitter or gate: 4,4/);
    bad(map([...HEADER, 'label q: unused'], [[0, 0, '@']]), /unused group "q"/);
    bad(map(HEADER.slice(1), [[0, 0, '@']]), /missing "name:"/);
    bad(map(HEADER, [[0, 0, '@']]).replace(EMPTY_ROW, EMPTY_ROW + '.'), /row 1 has 16 cells/);
    bad(map(HEADER, [[0, 0, '@']]) + '\n' + EMPTY_ROW, /expected 20 rows, got 21/);
  });
});

describe('puzzleToMap', () => {
  const cellSet = (p: any) => new Set(p.obstacle_groups.flatMap((g: any) => g.cells.map(([x, y]: number[]) => `${x},${y}`)));

  it('round-trips every puzzle in solver/puzzles', () => {
    const dir = path.join(__dirname, 'puzzles');
    for (const file of fs.readdirSync(dir).filter((f: string) => f.endsWith('.json'))) {
      const p = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const back = parseMap(puzzleToMap(p));
      for (const k of ['date', 'name', 'width', 'height', 'laser', 'num_mirrors', 'notes']) {
        assert.deepEqual(back[k], p[k], `${file}: ${k}`);
      }
      // Maps list splitters and gates in reading order.
      const sorted = (list: any[] = []) => [...list].sort((a, b) => a.y - b.y || a.x - b.x);
      assert.deepEqual(back.splitters, sorted(p.splitters), `${file}: splitters`);
      assert.deepEqual(back.gates, sorted(p.gates), `${file}: gates`);
      // A cell in two groups is kept in the first, so compare the cells overall.
      assert.deepEqual(cellSet(back), cellSet(p), `${file}: walls`);
      const labels = p.obstacle_groups.map((g: any) => g.label);
      for (const g of back.obstacle_groups) assert.ok(labels.includes(g.label), `${file}: label ${g.label}`);
    }
  });

  it('prints a puzzle that has no splitters list', () => {
    const p = parseMap(map(HEADER, [[0, 0, '@']]), '2026-12-01');
    delete p.splitters;
    assert.match(puzzleToMap(p), /^name: Test\ndate: 2026-12-01\nlaser: right\nmirrors: 9\n@\.{14}\n/);
  });
});

describe('formatPuzzleJson', () => {
  it('puts each cell on one line', () => {
    const p = parseMap(map(HEADER, [[0, 0, '@'], [3, 4, 'a']]), '2026-12-01');
    const text = formatPuzzleJson(p);
    assert.match(text, /"cells": \[\n\s+\[3, 4\]\n\s+\]/);
    assert.deepEqual(JSON.parse(text), p);
  });
});

// Laser at (0,10) heading right into a splitter at (7,10) that splits UP and DOWN.
const RIG = {
  name: 'rig', width: 15, height: 20, laserX: 0, laserY: 10, laserDir: 1,
  obstacles: [], splitters: [[7, 10, 'right']], gates: [], numMirrors: 2,
};

describe('analyzeLevel', () => {
  it('accepts a split where both beams place a mirror', () => {
    // Up beam turns right at (7,2): 8 cells up, 7 right, 1 off-grid.
    // Down beam turns right at (7,17): 7 down, 7 right, 1 off-grid.
    const { splitters, problems } = analyzeLevel(levelFromConfig(RIG, [[7, 2, '/'], [7, 17, '\\']]));
    assert.deepEqual(splitters[0].streams, [
      { direction: 'down', length: 15, mirrors: 1 },
      { direction: 'up', length: 16, mirrors: 1 },
    ]);
    assert.equal(splitters[0].ok, true);
    assert.deepEqual(problems, []);
  });

  it('flags a beam that places no mirror', () => {
    const { splitters, problems } = analyzeLevel(levelFromConfig(RIG, [[7, 2, '/']]));
    assert.equal(splitters[0].ok, false);
    assert.match(problems[0], /splitter \(7,10\) has a weak beam: down 10 cells\/0 mirrors/);
  });

  it('flags a splitter the optimal path never reaches', () => {
    const { problems } = analyzeLevel(levelFromConfig(RIG, [[3, 10, '/']]));
    assert.deepEqual(problems, ['splitter (7,10) never splits']);
  });

  it('counts the beams a split beam splits into again', () => {
    // The down beam hits a second splitter at (7,15), which splits it LEFT and RIGHT.
    const config = { ...RIG, splitters: [[7, 10, 'right'], [7, 15, 'down']] };
    const { splitters } = analyzeLevel(levelFromConfig(config, [[7, 2, '/']]));
    assert.deepEqual(splitters[0].streams.find((s: any) => s.direction === 'down'),
      { direction: 'down', length: 5 + 8 + 8, mirrors: 0 });
  });

  it('flags a gate whose entrance or exit is blocked, but not an unused open gate', () => {
    const level = (gate: number[], walls: number[][]) => levelFromConfig(
      { ...RIG, splitters: [], obstacles: walls, gates: [[...gate, 'up']] }, []);
    assert.deepEqual(analyzeLevel(level([5, 5], [])).problems, []);
    assert.match(analyzeLevel(level([5, 5], [[5, 6]])).problems[0], /gate \(5,5\) up can never be passed: its entrance/);
    assert.match(analyzeLevel(level([5, 5], [[5, 4]])).problems[0], /its exit is blocked/);
    assert.match(analyzeLevel(level([5, 19], [])).problems[0], /its entrance is blocked/);
  });

  it('counts gate passes', () => {
    const config = { ...RIG, splitters: [], gates: [[4, 10, 'right']] };
    assert.equal(analyzeLevel(levelFromConfig(config, [])).gates[0].passes, 1);
  });
});

describe('renderSolution', () => {
  it('draws the beam, mirrors, splitter and laser', () => {
    const rows = renderSolution(levelFromConfig(RIG, [[7, 2, '/'], [7, 17, '\\']])).split('\n');
    assert.equal(rows[2], ' 2        /-------');
    assert.equal(rows[10], '10 @------>       ');
    assert.equal(rows[17], '17        \\-------');
  });
});

describe('search_splitter', () => {
  const report = (streams: [number, number][]) =>
    [{ streams: streams.map(([length, mirrors]) => ({ direction: 'up', length, mirrors })) }];

  it('weakestStream: shortest beam, 0 for a beam with no mirror, -1 for no split', () => {
    assert.equal(weakestStream(report([[20, 2], [12, 1]])), 12);
    assert.equal(weakestStream(report([[20, 2], [30, 0]])), 0);
    assert.equal(weakestStream(report([[20, 2]])), -1);
  });

  it('rankCandidates: weakest beam first, then score', () => {
    const c = (weakest: number, score: number) => ({ x: 0, y: 0, dir: 'up', weakest, score, splitters: [] });
    assert.deepEqual(rankCandidates([c(0, 150), c(30, 120), c(30, 130), c(-1, 160)]).map((x: any) => [x.weakest, x.score]),
      [[30, 130], [30, 120], [0, 150], [-1, 160]]);
  });

  it('solves each candidate placement', async () => {
    const ranked = await searchSplitter(RIG, 0, [6, 7], [10], ['right', 'up'], { beamWidth: 200, workers: 2 });
    assert.deepEqual(ranked.map((c: any) => `${c.x},${c.y},${c.dir}`).sort(), ['6,10,right', '6,10,up', '7,10,right', '7,10,up']);
    assert.ok(ranked[0].weakest >= ranked[ranked.length - 1].weakest);
    assert.ok(ranked.every((c: any) => c.score > 0));
  });
});

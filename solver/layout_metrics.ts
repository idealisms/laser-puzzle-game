'use strict';
// Layout and optimal-solution shape metrics, shared by generate_levels.ts (post-solve warnings)
// and scripts/puzzle-features.ts (analysis against player enjoyment ratings).

const { calculateLaserPath } = require('../src/game/engine/simulate');

// Warning thresholds, chosen from enjoyment ratings (see scripts/puzzle-features.ts):
// puzzles rated 6-7 averaged 0.30 edge-path share and 0.41 anchored share; puzzles rated 1-2
// averaged 0.42 and 0.25.
const MAX_EDGE_PATH_SHARE = 0.4;
const MIN_ANCHORED_SHARE = 0.25;

interface Cell { x: number; y: number }

interface Bounds { left: number; right: number; top: number; bottom: number }

interface LevelShape {
  gridWidth: number;
  gridHeight: number;
  laserConfig: { x: number; y: number; direction: string };
  obstacles: { x: number; y: number; type?: string; orientation?: string }[];
  optimalSolution: { x: number; y: number; type: string }[];
}

const key = (x: number, y: number) => `${x},${y}`;

// The playable area inside any fully blocked border rows/columns.
function playableBounds(walls: Set<string>, width: number, height: number): Bounds {
  const rowBlocked = (y: number) => Array.from({ length: width }, (_, x) => x).every(x => walls.has(key(x, y)));
  const colBlocked = (x: number) => Array.from({ length: height }, (_, y) => y).every(y => walls.has(key(x, y)));
  const b = { left: 0, right: width - 1, top: 0, bottom: height - 1 };
  while (b.top < b.bottom && rowBlocked(b.top)) b.top++;
  while (b.bottom > b.top && rowBlocked(b.bottom)) b.bottom--;
  while (b.left < b.right && colBlocked(b.left)) b.left++;
  while (b.right > b.left && colBlocked(b.right)) b.right--;
  return b;
}

function edgeDistance(x: number, y: number, b: Bounds): number {
  return Math.min(x - b.left, b.right - x, y - b.top, b.bottom - y);
}

// 4-connected groups of obstacle cells.
function obstacleGroups(cells: Cell[]): Cell[][] {
  const remaining = new Map(cells.map(c => [key(c.x, c.y), c]));
  const groups: Cell[][] = [];
  for (const start of cells) {
    if (!remaining.has(key(start.x, start.y))) continue;
    const group: Cell[] = [];
    const stack = [start];
    remaining.delete(key(start.x, start.y));
    while (stack.length) {
      const c = stack.pop()!;
      group.push(c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = remaining.get(key(c.x + dx, c.y + dy));
        if (n) {
          remaining.delete(key(n.x, n.y));
          stack.push(n);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

// The beam as straight runs (the simulator records one segment per cell step), plus how many times
// each free cell is crossed, across all streams.
function traceBeam(laserPath: any, isFree: (x: number, y: number) => boolean) {
  const visits = new Map<string, number>();
  const runs: { horizontal: boolean; length: number }[] = [];
  for (const stream of laserPath.streams) {
    let prev: string | null = null;
    for (const seg of stream.segments) {
      if (seg.direction === prev) runs[runs.length - 1].length++;
      else runs.push({ horizontal: seg.direction === 'left' || seg.direction === 'right', length: 1 });
      prev = seg.direction;
      const { x, y } = seg.end;
      if (isFree(x, y)) visits.set(key(x, y), (visits.get(key(x, y)) ?? 0) + 1);
    }
  }
  return { visits, runs };
}

function measureShape(level: LevelShape) {
  const { obstacles } = level;
  const mirrors = level.optimalSolution.map(m => ({ position: { x: m.x, y: m.y }, type: m.type }));
  const borderWalls = new Set(obstacles.filter(o => (o.type ?? 'wall') === 'wall').map(o => key(o.x, o.y)));
  const bounds = playableBounds(borderWalls, level.gridWidth, level.gridHeight);
  const inside = (x: number, y: number) =>
    x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  const interior = obstacles.filter(o => inside(o.x, o.y));
  const groups = obstacleGroups(interior);
  const anchoredCells = groups
    .filter(g => g.some(c => edgeDistance(c.x, c.y, bounds) === 0))
    .reduce((a, g) => a + g.length, 0);

  const laserPath = calculateLaserPath(level.laserConfig, mirrors, obstacles,
    { width: level.gridWidth, height: level.gridHeight });
  const walls = new Set(obstacles.filter(o => o.type !== 'gate').map(o => key(o.x, o.y)));
  const { visits, runs } = traceBeam(laserPath, (x, y) => inside(x, y) && !walls.has(key(x, y)));
  const edgeCells = [...visits.keys()].filter(k => {
    const [x, y] = k.split(',').map(Number);
    return edgeDistance(x, y, bounds) === 0;
  }).length;

  return {
    bounds,
    interior,
    groups,
    visits,
    runs,
    mirrors,
    // Share of interior obstacle cells in groups that touch the playable edge.
    anchoredShare: interior.length ? anchoredCells / interior.length : 0,
    // Share of the cells on the optimal path that lie on the playable area's outer ring.
    edgePathShare: visits.size ? edgeCells / visits.size : 0,
  };
}

// Warnings for layouts whose optimal solution looks like the perimeter/sweep shapes players enjoy least.
function checkLayout({ edgePathShare, anchoredShare }: { edgePathShare: number; anchoredShare: number }): string[] {
  const warnings: string[] = [];
  if (edgePathShare > MAX_EDGE_PATH_SHARE) {
    warnings.push(
      `${(edgePathShare * 100).toFixed(0)}% of the optimal path is on the outer ring ` +
      `(max ${MAX_EDGE_PATH_SHARE * 100}%): the solution mostly hugs the perimeter.`
    );
  }
  if (anchoredShare < MIN_ANCHORED_SHARE) {
    warnings.push(
      `only ${(anchoredShare * 100).toFixed(0)}% of obstacle cells are in groups touching an edge ` +
      `(min ${MIN_ANCHORED_SHARE * 100}%): obstacles are easy to route around.`
    );
  }
  return warnings;
}

module.exports = {
  MAX_EDGE_PATH_SHARE,
  MIN_ANCHORED_SHARE,
  playableBounds,
  edgeDistance,
  obstacleGroups,
  traceBeam,
  measureShape,
  checkLayout,
};

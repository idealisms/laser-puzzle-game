// Measure layout and optimal-solution features for each puzzle and relate them to enjoyment and difficulty.
// Usage: npx tsx scripts/puzzle-features.ts [dump-dir]   (default: db-dump/)
// Reads <dump-dir>/Level.json, puzzle-ratings.csv and, if present, <dump-dir>/puzzle-difficulty.csv.
// Writes <dump-dir>/puzzle-features.csv and prints a summary.
import fs from 'fs'
import path from 'path'
import { calculateLaserPath } from '../src/game/engine/simulate'
import type { LaserConfig, LaserPath, Obstacle } from '../src/game/types'
import { type LevelRow, fmt, mean, parseMirrors, readDumpJson, readRatings, spearman } from './lib/analysis'

const DUMP_DIR = process.argv[2] ?? 'db-dump'
const RATINGS_CSV = 'puzzle-ratings.csv'
const PUZZLES_DIR = 'solver/puzzles'
// A row or column counts as a barrier when obstacles block at least this share of it.
const BARRIER_SHARE = 0.6
// Segments at least this long count as long straight runs.
const LONG_RUN = 10

interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
}

const key = (x: number, y: number) => `${x},${y}`

// The playable area inside any fully blocked border rows/columns.
function playableBounds(walls: Set<string>, width: number, height: number): Bounds {
  const rowBlocked = (y: number) => Array.from({ length: width }, (_, x) => x).every(x => walls.has(key(x, y)))
  const colBlocked = (x: number) => Array.from({ length: height }, (_, y) => y).every(y => walls.has(key(x, y)))
  const b = { left: 0, right: width - 1, top: 0, bottom: height - 1 }
  while (b.top < b.bottom && rowBlocked(b.top)) b.top++
  while (b.bottom > b.top && rowBlocked(b.bottom)) b.bottom--
  while (b.left < b.right && colBlocked(b.left)) b.left++
  while (b.right > b.left && colBlocked(b.right)) b.right--
  return b
}

function edgeDistance(x: number, y: number, b: Bounds): number {
  return Math.min(x - b.left, b.right - x, y - b.top, b.bottom - y)
}

// 4-connected groups of obstacle cells inside the playable area.
function components(cells: { x: number; y: number }[]): { x: number; y: number }[][] {
  const remaining = new Map(cells.map(c => [key(c.x, c.y), c]))
  const groups: { x: number; y: number }[][] = []
  for (const start of cells) {
    if (!remaining.has(key(start.x, start.y))) continue
    const group = []
    const stack = [start]
    remaining.delete(key(start.x, start.y))
    while (stack.length) {
      const c = stack.pop()!
      group.push(c)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = remaining.get(key(c.x + dx, c.y + dy))
        if (n) {
          remaining.delete(key(n.x, n.y))
          stack.push(n)
        }
      }
    }
    groups.push(group)
  }
  return groups
}

// The beam as straight runs (the simulator records one segment per cell step), plus how many times
// each free in-grid cell is crossed, across all streams.
function traceBeam(laserPath: LaserPath, isFree: (x: number, y: number) => boolean) {
  const visits = new Map<string, number>()
  const runs: { horizontal: boolean; length: number }[] = []
  for (const stream of laserPath.streams) {
    let prev: string | null = null
    for (const seg of stream.segments) {
      if (seg.direction === prev) runs[runs.length - 1].length++
      else runs.push({ horizontal: seg.direction === 'left' || seg.direction === 'right', length: 1 })
      prev = seg.direction
      const { x, y } = seg.end
      if (isFree(x, y)) visits.set(key(x, y), (visits.get(key(x, y)) ?? 0) + 1)
    }
  }
  return { visits, runs }
}

function loadPuzzleNames(): Map<string, string> {
  const names = new Map<string, string>()
  if (!fs.existsSync(PUZZLES_DIR)) return names
  for (const file of fs.readdirSync(PUZZLES_DIR)) {
    if (!file.endsWith('.json')) continue
    const { date, name } = JSON.parse(fs.readFileSync(path.join(PUZZLES_DIR, file), 'utf8'))
    if (date && name) names.set(date, name)
  }
  return names
}

function loadDifficulty(): Map<string, number> {
  const difficulty = new Map<string, number>()
  const file = path.join(DUMP_DIR, 'puzzle-difficulty.csv')
  if (!fs.existsSync(file)) return difficulty
  const [header, ...lines] = fs.readFileSync(file, 'utf8').trim().split('\n')
  const cols = header.split(',')
  const iDate = cols.indexOf('date'), iN = cols.indexOf('n'), iDiff = cols.indexOf('difficulty')
  for (const line of lines) {
    const v = line.split(',')
    // Too few players for the difficulty score to mean much.
    if (Number(v[iN]) >= 3) difficulty.set(v[iDate], Number(v[iDiff]))
  }
  return difficulty
}

const FEATURES = {
  mirrors: 'mirrors available',
  splitters: 'splitters',
  gates: 'gates',
  obstacleCells: 'interior obstacle cells',
  obstacleGroups: 'separate obstacle groups',
  anchoredShare: 'share of obstacle cells in groups touching an edge',
  barriers: 'rows/cols at least 60% blocked',
  optimalScore: 'optimal score',
  coverage: 'share of free cells the optimal beam visits',
  edgePathShare: 'share of optimal path on the outer ring',
  edgeMirrorShare: 'share of optimal mirrors on the outer ring',
  crossings: 'cells the optimal beam crosses twice+',
  segments: 'straight segments in optimal path',
  longRunShare: `share of optimal path in runs >= ${LONG_RUN}`,
  horizontalShare: 'share of optimal path moving horizontally',
} as const
type Feature = keyof typeof FEATURES

function measure(row: LevelRow): Record<Feature, number> {
  const laser = JSON.parse(row.laserConfig) as LaserConfig
  const obstacles = JSON.parse(row.obstacles) as Obstacle[]
  const mirrors = parseMirrors(row.optimalSolution)
  const borderWalls = new Set(obstacles.filter(o => (o.type ?? 'wall') === 'wall').map(o => key(o.x, o.y)))
  const b = playableBounds(borderWalls, row.gridWidth, row.gridHeight)
  const inside = (x: number, y: number) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom
  const interior = obstacles.filter(o => inside(o.x, o.y))
  const playableCells = (b.right - b.left + 1) * (b.bottom - b.top + 1)

  const groups = components(interior)
  const anchored = groups.filter(g => g.some(c => edgeDistance(c.x, c.y, b) === 0))
  const blocked = new Set(interior.map(o => key(o.x, o.y)))
  let barriers = 0
  for (let y = b.top; y <= b.bottom; y++) {
    let n = 0
    for (let x = b.left; x <= b.right; x++) if (blocked.has(key(x, y))) n++
    if (n >= BARRIER_SHARE * (b.right - b.left + 1)) barriers++
  }
  for (let x = b.left; x <= b.right; x++) {
    let n = 0
    for (let y = b.top; y <= b.bottom; y++) if (blocked.has(key(x, y))) n++
    if (n >= BARRIER_SHARE * (b.bottom - b.top + 1)) barriers++
  }

  const laserPath = calculateLaserPath(laser, mirrors, obstacles, { width: row.gridWidth, height: row.gridHeight })
  const walls = new Set(obstacles.filter(o => o.type !== 'gate').map(o => key(o.x, o.y)))
  const { visits, runs } = traceBeam(laserPath, (x, y) => inside(x, y) && !walls.has(key(x, y)))
  const pathLength = runs.reduce((a, r) => a + r.length, 0) || 1
  const edgeCells = [...visits.keys()].filter(k => {
    const [x, y] = k.split(',').map(Number)
    return edgeDistance(x, y, b) === 0
  })

  return {
    mirrors: row.mirrorsAvailable,
    splitters: obstacles.filter(o => o.type === 'splitter').length,
    gates: obstacles.filter(o => o.type === 'gate').length,
    obstacleCells: interior.length,
    obstacleGroups: groups.length,
    anchoredShare: interior.length ? anchored.reduce((a, g) => a + g.length, 0) / interior.length : 0,
    barriers,
    optimalScore: row.optimalScore,
    coverage: visits.size / (playableCells - interior.length),
    edgePathShare: visits.size ? edgeCells.length / visits.size : 0,
    edgeMirrorShare: mirrors.length
      ? mirrors.filter(m => edgeDistance(m.position.x, m.position.y, b) === 0).length / mirrors.length
      : 0,
    crossings: [...visits.values()].filter(v => v > 1).length,
    segments: runs.length,
    longRunShare: runs.filter(r => r.length >= LONG_RUN).reduce((a, r) => a + r.length, 0) / pathLength,
    horizontalShare: runs.filter(r => r.horizontal).reduce((a, r) => a + r.length, 0) / pathLength,
  }
}

function main() {
  const levels = readDumpJson<LevelRow[]>(DUMP_DIR, 'Level.json').sort((a, b) => a.date.localeCompare(b.date))
  const ratings = readRatings(RATINGS_CSV)
  const difficulty = loadDifficulty()
  const names = loadPuzzleNames()
  const features = Object.keys(FEATURES) as Feature[]

  const rows = levels.map(level => ({
    date: level.date,
    name: names.get(level.date) ?? '',
    rating: ratings.get(level.date) ?? null,
    difficulty: difficulty.get(level.date) ?? null,
    ...measure(level),
  }))

  const outFile = path.join(DUMP_DIR, 'puzzle-features.csv')
  const header = ['date', 'name', 'rating', 'difficulty', ...features]
  fs.writeFileSync(outFile, [header.join(',')].concat(rows.map(r => [
    r.date, `"${r.name}"`, r.rating ?? '', fmt(r.difficulty, 1),
    ...features.map(f => (Number.isInteger(r[f]) ? String(r[f]) : fmt(r[f]))),
  ].join(','))).join('\n') + '\n')
  console.log(`wrote ${rows.length} puzzles to ${outFile}\n`)

  const rated = rows.filter(r => r.rating !== null)
  const loved = rated.filter(r => r.rating! >= 6)
  const disliked = rated.filter(r => r.rating! <= 2)
  const withDiff = rows.filter(r => r.difficulty !== null)
  // Rough 95% threshold for a rank correlation to stand out from noise.
  const noise = (n: number) => (2 / Math.sqrt(n)).toFixed(2)
  console.log(`Spearman with enjoyment over ${rated.length} rated puzzles (|rho| > ${noise(rated.length)} stands out),`)
  console.log(`with difficulty over ${withDiff.length} puzzles with 3+ players (|rho| > ${noise(withDiff.length)}),`)
  console.log(`and feature means for puzzles rated 6-7 (${loved.length}) vs 1-2 (${disliked.length}):\n`)
  console.log(`${'feature'.padEnd(52)} enjoy  diff   6-7     1-2`)
  const lines = features.map(f => ({
    f,
    enjoy: spearman(rated.map(r => r.rating!), rated.map(r => r[f])),
    diff: spearman(withDiff.map(r => r.difficulty!), withDiff.map(r => r[f])),
  }))
  lines.sort((a, b) => Math.abs(b.enjoy) - Math.abs(a.enjoy))
  for (const { f, enjoy, diff } of lines) {
    const show = (v: number) => (Number.isFinite(v) ? v.toFixed(2).padStart(5) : '  -- ')
    const m = (rs: typeof rows) => mean(rs.map(r => r[f])).toFixed(2).padStart(7)
    console.log(`${FEATURES[f].padEnd(52)} ${show(enjoy)}  ${show(diff)} ${m(loved)} ${m(disliked)}`)
  }
}

main()

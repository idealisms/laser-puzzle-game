// Measure layout and optimal-solution features for each puzzle and relate them to enjoyment and difficulty.
// Usage: npx tsx scripts/puzzle-features.ts [dump-dir]   (default: db-dump/)
// Reads <dump-dir>/Level.json, puzzle-ratings.csv and, if present, <dump-dir>/puzzle-difficulty.csv.
// Writes <dump-dir>/puzzle-features.csv and prints a summary.
import fs from 'fs'
import path from 'path'
import type { LaserConfig, Obstacle } from '../src/game/types'
import { edgeDistance, measureShape } from '../solver/layout_metrics'
import { type LevelRow, fmt, mean, readDumpJson, readRatings, spearman } from './lib/analysis'

const DUMP_DIR = process.argv[2] ?? 'db-dump'
const RATINGS_CSV = 'puzzle-ratings.csv'
const PUZZLES_DIR = 'solver/puzzles'
// A row or column counts as a barrier when obstacles block at least this share of it.
const BARRIER_SHARE = 0.6
// Segments at least this long count as long straight runs.
const LONG_RUN = 10

const key = (x: number, y: number) => `${x},${y}`

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
  const obstacles = JSON.parse(row.obstacles) as Obstacle[]
  const optimalSolution = (JSON.parse(row.optimalSolution ?? '[]') as [number, number, string][])
    .map(([x, y, type]) => ({ x, y, type }))
  const shape = measureShape({
    gridWidth: row.gridWidth,
    gridHeight: row.gridHeight,
    laserConfig: JSON.parse(row.laserConfig) as LaserConfig,
    obstacles,
    optimalSolution,
  })
  const { bounds: b, interior, groups, visits, runs, mirrors } = shape
  const playableCells = (b.right - b.left + 1) * (b.bottom - b.top + 1)

  const blocked = new Set(interior.map((o: Obstacle) => key(o.x, o.y)))
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

  type Run = { horizontal: boolean; length: number }
  const pathLength = runs.reduce((a: number, r: Run) => a + r.length, 0) || 1

  return {
    mirrors: row.mirrorsAvailable,
    splitters: obstacles.filter(o => o.type === 'splitter').length,
    gates: obstacles.filter(o => o.type === 'gate').length,
    obstacleCells: interior.length,
    obstacleGroups: groups.length,
    anchoredShare: shape.anchoredShare,
    barriers,
    optimalScore: row.optimalScore,
    coverage: visits.size / (playableCells - interior.length),
    edgePathShare: shape.edgePathShare,
    edgeMirrorShare: mirrors.length
      ? mirrors.filter((m: { position: { x: number; y: number } }) => edgeDistance(m.position.x, m.position.y, b) === 0).length / mirrors.length
      : 0,
    crossings: [...visits.values()].filter((v: number) => v > 1).length,
    segments: runs.length,
    longRunShare: runs.filter((r: Run) => r.length >= LONG_RUN).reduce((a: number, r: Run) => a + r.length, 0) / pathLength,
    horizontalShare: runs.filter((r: Run) => r.horizontal).reduce((a: number, r: Run) => a + r.length, 0) / pathLength,
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

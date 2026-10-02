// Estimate per-puzzle difficulty from player submissions in a local DB dump.
// Usage: npx tsx scripts/puzzle-difficulty.ts [dump-dir]   (default: db-dump/)
// Writes <dump-dir>/puzzle-difficulty.csv and prints a summary.
import fs from 'fs'
import path from 'path'
import { calculateLaserPath } from '../src/game/engine/simulate'
import type { LaserConfig, LaserPath, Mirror, MirrorType, Obstacle } from '../src/game/types'

const DUMP_DIR = process.argv[2] ?? 'db-dump'
const RATINGS_CSV = 'puzzle-ratings.csv'

// Pseudo-count for shrinking per-puzzle averages toward the global mean.
const PRIOR_WEIGHT = 3
// Weights for the combined score; components missing for a puzzle are dropped and the rest renormalised.
// scoreSpread: a wide range of player scores suggests the long paths weren't obvious.
const WEIGHTS = { scoreGap: 0.4, pathMiss: 0.35, scoreSpread: 0.25 }

interface LevelRow {
  id: string
  date: string
  gridWidth: number
  gridHeight: number
  laserConfig: string
  obstacles: string
  mirrorsAvailable: number
  optimalScore: number
  optimalSolution: string | null
}

interface SubmissionRow {
  levelId: string
  playerId: string
  score: number
  mirrors: string | null
  timeSpentSeconds: number | null
  mirrorsErased: number | null
  resetCount: number | null
}

interface Level {
  date: string
  laser: LaserConfig
  obstacles: Obstacle[]
  bounds: { width: number; height: number }
  optimalScore: number
  optimalMirrors: Mirror[]
  optimalCells: Set<string>
}

interface SubmissionAnalysis {
  ratio: number
  solved: boolean
  pathOverlap: number | null
  mirrorCredit: number | null
  exact: number
  flipped: number
  near: number
  off: number
  timeSpentSeconds: number | null
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DUMP_DIR, file), 'utf8'))
}

// Mirror lists are stored as [[x, y, type], ...]; a few early submissions used [{x, y, type}, ...].
type StoredMirror = [number, number, MirrorType] | { x: number; y: number; type: MirrorType }

function parseMirrors(json: string | null): Mirror[] {
  if (!json) return []
  return (JSON.parse(json) as StoredMirror[]).map(m => {
    const [x, y, type] = Array.isArray(m) ? m : [m.x, m.y, m.type]
    return { position: { x, y }, type }
  })
}

// Every grid cell the beam passes through, across all streams.
function pathCells(laserPath: LaserPath): Set<string> {
  const cells = new Set<string>()
  for (const stream of laserPath.streams) {
    for (const seg of stream.segments) {
      const dx = Math.sign(seg.end.x - seg.start.x)
      const dy = Math.sign(seg.end.y - seg.start.y)
      let { x, y } = seg.start
      cells.add(`${x},${y}`)
      while (x !== seg.end.x || y !== seg.end.y) {
        x += dx
        y += dy
        cells.add(`${x},${y}`)
      }
    }
  }
  return cells
}

// Greedy minimum-cost pairing of player mirrors to optimal mirrors.
// Cost is Manhattan distance, plus 1 if the mirror faces the other way.
function matchMirrors(player: Mirror[], optimal: Mirror[]) {
  const pairs: { i: number; j: number; dist: number; sameType: boolean }[] = []
  player.forEach((p, i) =>
    optimal.forEach((o, j) => {
      const dist = Math.abs(p.position.x - o.position.x) + Math.abs(p.position.y - o.position.y)
      pairs.push({ i, j, dist, sameType: p.type === o.type })
    })
  )
  pairs.sort((a, b) => a.dist + (a.sameType ? 0 : 1) - (b.dist + (b.sameType ? 0 : 1)))

  const usedP = new Set<number>()
  const usedO = new Set<number>()
  let exact = 0, flipped = 0, near = 0, credit = 0
  for (const { i, j, dist, sameType } of pairs) {
    if (usedP.has(i) || usedO.has(j)) continue
    usedP.add(i)
    usedO.add(j)
    if (dist === 0 && sameType) exact++
    else if (dist === 0) flipped++
    else if (dist <= 2) near++
    credit += Math.max(0, 1 - (dist + (sameType ? 0 : 1)) / 4)
  }
  const off = optimal.length - exact - flipped - near
  return { exact, flipped, near, off, credit: optimal.length ? credit / optimal.length : 0 }
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function shrink(values: number[], prior: number): number {
  return (values.reduce((a, b) => a + b, 0) + PRIOR_WEIGHT * prior) / (values.length + PRIOR_WEIGHT)
}

function sumSquaredDeviations(xs: number[]): number {
  const m = mean(xs)
  return xs.reduce((a, x) => a + (x - m) ** 2, 0)
}

// Standard deviation, pooled with PRIOR_WEIGHT degrees of freedom at the global variance.
function shrunkStdDev(xs: number[], priorVariance: number): number {
  const df = xs.length - 1
  return Math.sqrt((sumSquaredDeviations(xs) + PRIOR_WEIGHT * priorVariance) / (df + PRIOR_WEIGHT))
}

// Percentile rank in [0, 1] of each value among the non-null values.
function percentileRanks(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null).sort((a, b) => a - b)
  if (present.length < 2) return values.map(v => (v === null ? null : 0.5))
  return values.map(v => {
    if (v === null) return null
    const below = present.filter(p => p < v).length
    const equal = present.filter(p => p === v).length
    return (below + (equal - 1) / 2) / (present.length - 1)
  })
}

function spearman(a: number[], b: number[]): number {
  const ra = percentileRanks(a) as number[]
  const rb = percentileRanks(b) as number[]
  const ma = mean(ra), mb = mean(rb)
  let num = 0, da = 0, db = 0
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb)
    da += (ra[i] - ma) ** 2
    db += (rb[i] - mb) ** 2
  }
  return num / Math.sqrt(da * db)
}

function fmt(v: number | null, digits = 3): string {
  return v === null ? '' : v.toFixed(digits)
}

function main() {
  const levelRows = readJson<LevelRow[]>('Level.json')
  const submissions = readJson<SubmissionRow[]>('ScoreSubmission.json')

  const levels = new Map<string, Level>()
  for (const row of levelRows) {
    const laser = JSON.parse(row.laserConfig) as LaserConfig
    const obstacles = JSON.parse(row.obstacles) as Obstacle[]
    const bounds = { width: row.gridWidth, height: row.gridHeight }
    const optimalMirrors = parseMirrors(row.optimalSolution)
    levels.set(row.id, {
      date: row.date,
      laser,
      obstacles,
      bounds,
      optimalScore: row.optimalScore,
      optimalMirrors,
      optimalCells: pathCells(calculateLaserPath(laser, optimalMirrors, obstacles, bounds)),
    })
  }

  const byLevel = new Map<string, SubmissionAnalysis[]>()
  let scoreMismatches = 0
  for (const sub of submissions) {
    const level = levels.get(sub.levelId)
    if (!level) continue
    const solved = sub.score >= level.optimalScore
    if (sub.score > level.optimalScore) {
      console.log(`note: ${level.date} player scored ${sub.score} > optimal ${level.optimalScore}`)
    }

    let pathOverlap: number | null = null
    let mirrorCredit: number | null = null
    let exact = 0, flipped = 0, near = 0, off = 0
    if (sub.mirrors && level.optimalMirrors.length) {
      const mirrors = parseMirrors(sub.mirrors)
      const playerPath = calculateLaserPath(level.laser, mirrors, level.obstacles, level.bounds)
      if (playerPath.totalLength !== sub.score) scoreMismatches++
      const cells = pathCells(playerPath)
      const shared = [...level.optimalCells].filter(c => cells.has(c)).length
      const match = matchMirrors(mirrors, level.optimalMirrors)
      ;({ exact, flipped, near, off } = match)
      // A different solution that still hits optimal isn't a miss.
      pathOverlap = solved ? 1 : shared / level.optimalCells.size
      mirrorCredit = solved ? 1 : match.credit
    }

    const list = byLevel.get(sub.levelId) ?? []
    list.push({
      ratio: Math.min(1, sub.score / level.optimalScore),
      solved,
      pathOverlap,
      mirrorCredit,
      exact, flipped, near, off,
      timeSpentSeconds: sub.timeSpentSeconds,
    })
    byLevel.set(sub.levelId, list)
  }
  if (scoreMismatches) console.log(`warning: ${scoreMismatches} submissions whose mirrors don't reproduce their score`)

  const all = [...byLevel.values()].flat()
  const withPath = all.filter(s => s.pathOverlap !== null)
  const globalRatio = mean(all.map(s => s.ratio))
  const globalOverlap = mean(withPath.map(s => s.pathOverlap!))
  const groups = [...byLevel.values()]
  const pooledVariance =
    groups.reduce((a, subs) => a + sumSquaredDeviations(subs.map(s => s.ratio)), 0) /
    groups.reduce((a, subs) => a + subs.length - 1, 0)

  const rows = [...byLevel.entries()].map(([levelId, subs]) => {
    const level = levels.get(levelId)!
    const mirrored = subs.filter(s => s.pathOverlap !== null)
    const times = subs.map(s => s.timeSpentSeconds).filter((t): t is number => t !== null)
    return {
      date: level.date,
      optimalScore: level.optimalScore,
      n: subs.length,
      nMirrors: mirrored.length,
      solveRate: mean(subs.map(s => (s.solved ? 1 : 0))),
      meanRatio: mean(subs.map(s => s.ratio)),
      meanPathOverlap: mirrored.length ? mean(mirrored.map(s => s.pathOverlap!)) : null,
      meanMirrorCredit: mirrored.length ? mean(mirrored.map(s => s.mirrorCredit!)) : null,
      exact: mirrored.reduce((a, s) => a + s.exact, 0),
      flipped: mirrored.reduce((a, s) => a + s.flipped, 0),
      near: mirrored.reduce((a, s) => a + s.near, 0),
      off: mirrored.reduce((a, s) => a + s.off, 0),
      medianTime: times.length ? median(times) : null,
      scoreGap: 1 - shrink(subs.map(s => s.ratio), globalRatio),
      pathMiss: mirrored.length ? 1 - shrink(mirrored.map(s => s.pathOverlap!), globalOverlap) : null,
      scoreSpread: shrunkStdDev(subs.map(s => s.ratio), pooledVariance),
      difficulty: 0,
    }
  })

  const components = Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]
  const ranks = {
    scoreGap: percentileRanks(rows.map(r => r.scoreGap)),
    pathMiss: percentileRanks(rows.map(r => r.pathMiss)),
    scoreSpread: percentileRanks(rows.map(r => r.scoreSpread)),
  }
  rows.forEach((row, i) => {
    let total = 0, weight = 0
    for (const c of components) {
      const r = ranks[c][i]
      if (r === null) continue
      total += WEIGHTS[c] * r
      weight += WEIGHTS[c]
    }
    row.difficulty = (100 * total) / weight
  })
  rows.sort((a, b) => a.date.localeCompare(b.date))

  const header = [
    'date', 'optimalScore', 'n', 'nMirrors', 'solveRate', 'meanRatio', 'scoreSpread', 'meanPathOverlap',
    'meanMirrorCredit', 'exact', 'flipped', 'near', 'off', 'medianTime', 'difficulty',
  ]
  const csv = [header.join(',')].concat(
    rows.map(r => [
      r.date, r.optimalScore, r.n, r.nMirrors, fmt(r.solveRate), fmt(r.meanRatio), fmt(r.scoreSpread), fmt(r.meanPathOverlap),
      fmt(r.meanMirrorCredit), r.exact, r.flipped, r.near, r.off, fmt(r.medianTime, 0), fmt(r.difficulty, 1),
    ].join(','))
  )
  const outFile = path.join(DUMP_DIR, 'puzzle-difficulty.csv')
  fs.writeFileSync(outFile, csv.join('\n') + '\n')
  console.log(`wrote ${rows.length} puzzles to ${outFile}\n`)

  const byDifficulty = [...rows].sort((a, b) => b.difficulty - a.difficulty)
  const show = (r: (typeof rows)[number]) =>
    `  ${r.date}  diff=${r.difficulty.toFixed(0).padStart(3)}  n=${String(r.n).padStart(2)}  ` +
    `ratio=${r.meanRatio.toFixed(2)}  spread=${r.scoreSpread.toFixed(3)}  ` +
    `overlap=${r.meanPathOverlap === null ? ' -- ' : r.meanPathOverlap.toFixed(2)}`
  console.log('Hardest (n >= 3):')
  byDifficulty.filter(r => r.n >= 3).slice(0, 10).forEach(r => console.log(show(r)))
  console.log('\nEasiest (n >= 3):')
  byDifficulty.filter(r => r.n >= 3).slice(-10).reverse().forEach(r => console.log(show(r)))

  // Sanity checks: how the components relate, and whether difficulty predicts enjoyment.
  const both = rows.filter(r => r.meanPathOverlap !== null)
  console.log(`\nSpearman(scoreGap, pathMiss) over ${both.length} puzzles with mirror data: ` +
    spearman(both.map(r => r.scoreGap), both.map(r => r.pathMiss!)).toFixed(2))
  console.log(`Spearman(scoreGap, scoreSpread) over ${rows.length} puzzles: ` +
    spearman(rows.map(r => r.scoreGap), rows.map(r => r.scoreSpread)).toFixed(2))

  if (fs.existsSync(RATINGS_CSV)) {
    const ratings = new Map<string, number>()
    for (const line of fs.readFileSync(RATINGS_CSV, 'utf8').trim().split('\n').slice(1)) {
      const [date, rating] = line.split(',')
      if (rating) ratings.set(date, Number(rating))
    }
    const rated = rows.filter(r => ratings.has(r.date) && r.n >= 3)
    console.log(`Spearman(difficulty, enjoyment rating) over ${rated.length} puzzles with n >= 3: ` +
      spearman(rated.map(r => r.difficulty), rated.map(r => ratings.get(r.date)!)).toFixed(2))
  }
}

main()

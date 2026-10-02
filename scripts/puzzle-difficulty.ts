// Estimate per-puzzle difficulty from player submissions in a local DB dump.
// Usage: npx tsx scripts/puzzle-difficulty.ts [dump-dir]   (default: db-dump/)
// Writes <dump-dir>/puzzle-difficulty.csv and prints a summary.
import fs from 'fs'
import path from 'path'
import { calculateLaserPath } from '../src/game/engine/simulate'
import type { LaserConfig, Mirror, Obstacle } from '../src/game/types'
import {
  type LevelRow, fmt, mean, median, parseMirrors, pathCells, percentileRanks, readDumpJson, readRatings, spearman,
} from './lib/analysis'

const DUMP_DIR = process.argv[2] ?? 'db-dump'
const RATINGS_CSV = 'puzzle-ratings.csv'

// Pseudo-count for shrinking per-puzzle averages toward the global mean.
const PRIOR_WEIGHT = 3
// Submissions below this fraction of optimal are treated as abandoned attempts and ignored.
const MIN_SCORE_RATIO = 0.7
// Weights for the combined score; components missing for a puzzle are dropped and the rest renormalised.
// scoreSpread: a wide range of player scores suggests the long paths weren't obvious.
const WEIGHTS = { scoreGap: 0.4, pathMiss: 0.35, scoreSpread: 0.25 }

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

function main() {
  const levelRows = readDumpJson<LevelRow[]>(DUMP_DIR, 'Level.json')
  const submissions = readDumpJson<SubmissionRow[]>(DUMP_DIR, 'ScoreSubmission.json')

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
  let discarded = 0
  for (const sub of submissions) {
    const level = levels.get(sub.levelId)
    if (!level) continue
    if (sub.score < MIN_SCORE_RATIO * level.optimalScore) {
      discarded++
      continue
    }
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
  console.log(`discarded ${discarded} submissions below ${MIN_SCORE_RATIO * 100}% of optimal`)
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

  const ratings = readRatings(RATINGS_CSV)
  if (ratings.size) {
    const rated = rows.filter(r => ratings.has(r.date) && r.n >= 3)
    console.log(`Spearman(difficulty, enjoyment rating) over ${rated.length} puzzles with n >= 3: ` +
      spearman(rated.map(r => r.difficulty), rated.map(r => ratings.get(r.date)!)).toFixed(2))
  }
}

main()

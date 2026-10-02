// Shared helpers for the offline puzzle analysis scripts.
import fs from 'fs'
import path from 'path'
import type { LaserPath, Mirror, MirrorType } from '../../src/game/types'

export interface LevelRow {
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

export function readDumpJson<T>(dumpDir: string, file: string): T {
  return JSON.parse(fs.readFileSync(path.join(dumpDir, file), 'utf8'))
}

// Enjoyment ratings keyed by date; unrated puzzles are omitted.
export function readRatings(csvPath: string): Map<string, number> {
  const ratings = new Map<string, number>()
  if (!fs.existsSync(csvPath)) return ratings
  for (const line of fs.readFileSync(csvPath, 'utf8').trim().split('\n').slice(1)) {
    const [date, rating] = line.split(',')
    if (rating) ratings.set(date, Number(rating))
  }
  return ratings
}

// Mirror lists are stored as [[x, y, type], ...]; a few early submissions used [{x, y, type}, ...].
type StoredMirror = [number, number, MirrorType] | { x: number; y: number; type: MirrorType }

export function parseMirrors(json: string | null): Mirror[] {
  if (!json) return []
  return (JSON.parse(json) as StoredMirror[]).map(m => {
    const [x, y, type] = Array.isArray(m) ? m : [m.x, m.y, m.type]
    return { position: { x, y }, type }
  })
}

// Every grid cell the beam passes through, across all streams.
export function pathCells(laserPath: LaserPath): Set<string> {
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

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Percentile rank in [0, 1] of each value among the non-null values.
export function percentileRanks(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null).sort((a, b) => a - b)
  if (present.length < 2) return values.map(v => (v === null ? null : 0.5))
  return values.map(v => {
    if (v === null) return null
    const below = present.filter(p => p < v).length
    const equal = present.filter(p => p === v).length
    return (below + (equal - 1) / 2) / (present.length - 1)
  })
}

export function spearman(a: number[], b: number[]): number {
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

export function fmt(v: number | null, digits = 3): string {
  return v === null ? '' : v.toFixed(digits)
}

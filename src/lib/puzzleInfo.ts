import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import type { LevelConfig } from '@/game/types'
import puzzleNames from '@/data/puzzle-names.json'

// Server-side facts about a day's puzzle, for page titles and link previews.
// Nothing here may reveal a puzzle before it's released.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isValidPuzzleDate(date: string): boolean {
  return DATE_REGEX.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
}

/** The latest date that has started somewhere in the world (UTC+14 is first). */
export function latestReleasedDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString().split('T')[0]
}

/** Whether a day's puzzle can be shown yet. Always true in dev mode. */
export function isPuzzleReleased(date: string, now: Date = new Date()): boolean {
  if (process.env.NEXT_PUBLIC_APP_MODE === 'DEV') return true
  return date <= latestReleasedDate(now)
}

export function getPuzzleName(date: string): string | null {
  return (puzzleNames as Record<string, string>)[date] ?? null
}

/** "2026-12-18" → "Dec 18, 2026" */
export function formatPuzzleDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Dec 18, 2026: Icicles", or just the date for a puzzle without a name. */
export function puzzleHeading(date: string): string {
  const name = getPuzzleName(date)
  return name ? `${formatPuzzleDate(date)}: ${name}` : formatPuzzleDate(date)
}

/** "11 mirrors, with splitters and portals" */
export function describeFeatures(level: Pick<LevelConfig, 'mirrorsAvailable' | 'obstacles'>): string {
  const count = (type: string) => level.obstacles.filter((o) => o.type === type).length
  const name = (n: number, one: string, many: string) => (n === 0 ? null : n === 1 ? one : many)
  const features = [
    name(count('splitter'), 'a splitter', 'splitters'),
    name(count('gate'), 'a one-way gate', 'one-way gates'),
    name(count('portal') / 2, 'portals', 'portals'),
  ].filter(Boolean) as string[]
  const mirrors = `${level.mirrorsAvailable} mirrors`
  if (features.length === 0) return mirrors
  const list = features.length === 1 ? features[0] : `${features.slice(0, -1).join(', ')} and ${features.at(-1)}`
  return `${mirrors}, with ${list}`
}

export interface ReleasedPuzzle {
  date: string
  name: string | null
  level: LevelConfig
}

/**
 * The puzzle for a date, or null if the date is malformed, not released yet,
 * or has no puzzle. Cached per request, so metadata and the page share a query.
 */
export const getReleasedPuzzle = cache(async (date: string): Promise<ReleasedPuzzle | null> => {
  if (!isValidPuzzleDate(date) || !isPuzzleReleased(date)) return null
  const row = await prisma.level.findUnique({ where: { date } })
  if (!row) return null
  return {
    date,
    name: getPuzzleName(date),
    level: {
      gridWidth: row.gridWidth,
      gridHeight: row.gridHeight,
      laserConfig: JSON.parse(row.laserConfig),
      obstacles: JSON.parse(row.obstacles),
      mirrorsAvailable: row.mirrorsAvailable,
      optimalScore: row.optimalScore,
    },
  }
})

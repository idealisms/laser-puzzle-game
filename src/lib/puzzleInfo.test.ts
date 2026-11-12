import fs from 'fs'
import path from 'path'
import puzzleNames from '@/data/puzzle-names.json'
import { prisma } from '@/lib/prisma'
import {
  describeFeatures,
  getReleasedPuzzle,
  formatPuzzleDate,
  isValidPuzzleDate,
  latestReleasedDate,
  puzzleHeading,
} from './puzzleInfo'

jest.mock('@/lib/prisma', () => ({ prisma: { level: { findUnique: jest.fn() } } }))
// React's cache() only dedupes inside a request; in tests it just calls through.
jest.mock('react', () => ({ ...jest.requireActual('react'), cache: (fn: unknown) => fn }))

describe('puzzle-names.json', () => {
  it('matches the names in solver/puzzles (run `cd solver && npx tsx export_puzzle_names.ts`)', () => {
    const dir = path.join(__dirname, '..', '..', 'solver', 'puzzles')
    const expected: Record<string, string> = {}
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()) {
      const name = fs.readFileSync(path.join(dir, file), 'utf8').match(/^name: (.*)$/m)?.[1].trim()
      if (name) expected[file.slice(0, -4)] = name
    }
    expect(puzzleNames).toEqual(expected)
  })
})

describe('dates', () => {
  it('formats a date for titles', () => {
    expect(formatPuzzleDate('2026-12-18')).toBe('Dec 18, 2026')
    expect(formatPuzzleDate('2027-01-01')).toBe('Jan 1, 2027')
  })

  it('validates dates', () => {
    expect(isValidPuzzleDate('2026-12-18')).toBe(true)
    expect(isValidPuzzleDate('2026-13-01')).toBe(false)
    expect(isValidPuzzleDate('2026-1-1')).toBe(false)
    expect(isValidPuzzleDate('../etc')).toBe(false)
  })

  it('releases a day once it has started anywhere (UTC+14)', () => {
    expect(latestReleasedDate(new Date('2026-12-17T09:59:00Z'))).toBe('2026-12-17')
    expect(latestReleasedDate(new Date('2026-12-17T10:00:00Z'))).toBe('2026-12-18')
  })
})

describe('headings and descriptions', () => {
  it('names the puzzle when it has a name', () => {
    expect(puzzleHeading('2026-12-18')).toBe('Dec 18, 2026: Icicles')
    expect(puzzleHeading('1999-01-01')).toBe('Jan 1, 1999')
  })

  it('lists the special pieces', () => {
    expect(describeFeatures({ mirrorsAvailable: 9, obstacles: [{ x: 0, y: 0 }] })).toBe('9 mirrors')
    expect(
      describeFeatures({
        mirrorsAvailable: 9,
        obstacles: [
          { x: 0, y: 0, type: 'portal', pair: 1 },
          { x: 5, y: 5, type: 'portal', pair: 1 },
        ],
      })
    ).toBe('9 mirrors, with portals')
    expect(describeFeatures({ mirrorsAvailable: 8, obstacles: [{ x: 0, y: 0, type: 'splitter' }] })).toBe(
      '8 mirrors, with a splitter'
    )
    expect(
      describeFeatures({
        mirrorsAvailable: 11,
        obstacles: [
          { x: 0, y: 0, type: 'splitter' },
          { x: 1, y: 0, type: 'splitter' },
          { x: 2, y: 0, type: 'gate' },
          { x: 3, y: 0, type: 'gate' },
          { x: 4, y: 0, type: 'portal' },
          { x: 5, y: 0, type: 'portal' },
        ],
      })
    ).toBe('11 mirrors, with splitters, one-way gates and portals')
  })
})

describe('getReleasedPuzzle', () => {
  const findUnique = prisma.level.findUnique as jest.Mock
  const row = {
    gridWidth: 15,
    gridHeight: 20,
    laserConfig: '{"x":0,"y":0,"direction":"right"}',
    obstacles: '[{"x":3,"y":3}]',
    mirrorsAvailable: 11,
    optimalScore: 99,
  }

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_MODE
    findUnique.mockReset().mockResolvedValue(row)
    jest.useFakeTimers().setSystemTime(new Date('2026-12-17T09:00:00Z')) // Dec 18 hasn't started anywhere
  })
  afterEach(() => jest.useRealTimers())

  it('returns a released puzzle with its name', async () => {
    const puzzle = await getReleasedPuzzle('2026-12-17')
    expect(puzzle).toMatchObject({ date: '2026-12-17', level: { mirrorsAvailable: 11, obstacles: [{ x: 3, y: 3 }] } })
  })

  it('never looks up a puzzle that is not released yet', async () => {
    expect(await getReleasedPuzzle('2026-12-18')).toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('rejects malformed dates without a lookup', async () => {
    expect(await getReleasedPuzzle('2026-12-1x')).toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('returns null when there is no puzzle that day', async () => {
    findUnique.mockResolvedValue(null)
    expect(await getReleasedPuzzle('2020-01-01')).toBeNull()
  })

  it('does not include the solution', async () => {
    findUnique.mockResolvedValue({ ...row, optimalSolution: '["1,1,/"]' })
    const puzzle = await getReleasedPuzzle('2026-12-17')
    expect(puzzle?.level).not.toHaveProperty('optimalSolution')
  })
})

import { buildPuzzleIndex, PackConfig, LevelData } from './prepare-pack'

const mockPack: PackConfig = {
  name: 'Laser Puzzle Game',
  subtitle: 'Puzzle Pack',
  dailySiteUrl: 'https://laser-puzzle-game.vercel.app/',
  dailySiteName: 'Play the daily game',
  puzzles: ['2026-01-22', '2026-01-24', '2026-02-26'],
}

const mockLevels: Record<string, LevelData> = {
  '2026-01-22': {
    date: '2026-01-22',
    gridWidth: 15,
    gridHeight: 20,
    laserConfig: { x: 0, y: 0, direction: 'right' },
    obstacles: [],
    mirrorsAvailable: 10,
    optimalScore: 104,
  },
  '2026-01-24': {
    date: '2026-01-24',
    gridWidth: 15,
    gridHeight: 20,
    laserConfig: { x: 0, y: 0, direction: 'right' },
    obstacles: [],
    mirrorsAvailable: 10,
    optimalScore: 129,
  },
  '2026-02-26': {
    date: '2026-02-26',
    gridWidth: 15,
    gridHeight: 20,
    laserConfig: { x: 0, y: 0, direction: 'right' },
    obstacles: [],
    mirrorsAvailable: 10,
    optimalScore: 115,
  },
}

const mockNames: Record<string, string> = {
  '2026-01-22': 'Chamber Grid',
  '2026-01-24': 'Fortress',
  '2026-02-26': 'Archipelago',
}

describe('buildPuzzleIndex', () => {
  it('returns one entry per puzzle in the pack', () => {
    const index = buildPuzzleIndex(mockPack, mockLevels, mockNames)
    expect(index).toHaveLength(3)
  })

  it('includes date, name, number, and optimalScore for each entry', () => {
    const index = buildPuzzleIndex(mockPack, mockLevels, mockNames)
    expect(index[0]).toEqual({
      date: '2026-01-22',
      name: 'Chamber Grid',
      number: 1,
      optimalScore: 104,
    })
  })

  it('numbers puzzles starting from 1 in order', () => {
    const index = buildPuzzleIndex(mockPack, mockLevels, mockNames)
    expect(index.map((e) => e.number)).toEqual([1, 2, 3])
  })

  it('preserves the order from pack.json puzzles array', () => {
    const index = buildPuzzleIndex(mockPack, mockLevels, mockNames)
    expect(index.map((e) => e.date)).toEqual(['2026-01-22', '2026-01-24', '2026-02-26'])
  })

  it('uses the date as name fallback when name is missing', () => {
    const index = buildPuzzleIndex(mockPack, mockLevels, {})
    expect(index[0].name).toBe('2026-01-22')
  })

  it('uses 0 as optimalScore fallback when level data is missing', () => {
    const index = buildPuzzleIndex(mockPack, {}, mockNames)
    expect(index[0].optimalScore).toBe(0)
  })
})

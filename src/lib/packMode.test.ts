import { isPackMode, getLevelFetchUrl, parseLevelResponse, getCalendarFetchUrl } from './packMode'
import { LevelConfig } from '@/game/types'

describe('packMode utilities', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_MODE
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('isPackMode', () => {
    it('returns true when APP_MODE is pack', () => {
      process.env.NEXT_PUBLIC_APP_MODE = 'pack'
      expect(isPackMode()).toBe(true)
    })

    it('returns false when APP_MODE is unset', () => {
      expect(isPackMode()).toBe(false)
    })

    it('returns false when APP_MODE is DEV', () => {
      process.env.NEXT_PUBLIC_APP_MODE = 'DEV'
      expect(isPackMode()).toBe(false)
    })
  })

  describe('getLevelFetchUrl', () => {
    it('returns static puzzles path in pack mode', () => {
      process.env.NEXT_PUBLIC_APP_MODE = 'pack'
      expect(getLevelFetchUrl('2026-01-22')).toBe('/puzzles/2026-01-22.json')
    })

    it('returns API path in daily mode', () => {
      expect(getLevelFetchUrl('2026-01-22')).toBe('/api/levels/2026-01-22')
    })

    it('includes the date in the path', () => {
      process.env.NEXT_PUBLIC_APP_MODE = 'pack'
      expect(getLevelFetchUrl('2026-04-06')).toBe('/puzzles/2026-04-06.json')
    })
  })

  describe('parseLevelResponse', () => {
    const mockLevel: LevelConfig = {
      gridWidth: 15,
      gridHeight: 20,
      laserConfig: { x: 0, y: 0, direction: 'right' },
      obstacles: [],
      mirrorsAvailable: 10,
      optimalScore: 100,
    }

    it('returns data directly in pack mode (no wrapper)', () => {
      process.env.NEXT_PUBLIC_APP_MODE = 'pack'
      const result = parseLevelResponse(mockLevel)
      expect(result).toBe(mockLevel)
    })

    it('extracts data.level in daily mode', () => {
      const wrapped = { level: mockLevel }
      const result = parseLevelResponse(wrapped)
      expect(result).toBe(mockLevel)
    })
  })

  describe('getCalendarFetchUrl', () => {
    it('returns static index path in pack mode', () => {
      process.env.NEXT_PUBLIC_APP_MODE = 'pack'
      expect(getCalendarFetchUrl()).toBe('/puzzles/index.json')
    })

    it('returns calendar API path in daily mode', () => {
      expect(getCalendarFetchUrl()).toBe('/api/levels/calendar')
    })
  })
})

import { validateMirrors, computeScore } from './scoring'
import { calculateLaserPath, calculateScore } from '@/game/engine/Laser'
import { Mirror } from '@/game/types'

// LevelData uses JSON strings for laserConfig and obstacles (matches DB shape)
const testLevel = {
  gridWidth: 5,
  gridHeight: 5,
  laserConfig: JSON.stringify({ x: -1, y: 2, direction: 'right' }),
  obstacles: JSON.stringify([{ x: 4, y: 4 }]),
  mirrorsAvailable: 3,
}

describe('validateMirrors', () => {
  it('accepts valid mirrors', () => {
    const result = validateMirrors(
      [{ x: 1, y: 2, type: '/' }],
      testLevel
    )
    expect(result.valid).toBe(true)
  })

  it('rejects too many mirrors', () => {
    const mirrors = [
      { x: 0, y: 0, type: '/' },
      { x: 1, y: 0, type: '/' },
      { x: 2, y: 0, type: '/' },
      { x: 3, y: 0, type: '/' },
    ]
    const result = validateMirrors(mirrors, testLevel)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/Too many mirrors/)
  })

  it('rejects invalid mirror type', () => {
    const result = validateMirrors(
      [{ x: 1, y: 1, type: 'X' }],
      testLevel
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/Invalid mirror data/)
  })

  it('rejects non-integer coordinates', () => {
    const result = validateMirrors(
      [{ x: 1.5, y: 2, type: '/' }],
      testLevel
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/integers/)
  })

  it('rejects out of bounds', () => {
    const result = validateMirrors(
      [{ x: 5, y: 0, type: '/' }],
      testLevel
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/out of bounds/)
  })

  it('rejects placement on obstacle', () => {
    const result = validateMirrors(
      [{ x: 4, y: 4, type: '/' }],
      testLevel
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/obstacle/)
  })

  it('rejects duplicate positions', () => {
    const result = validateMirrors(
      [
        { x: 1, y: 1, type: '/' },
        { x: 1, y: 1, type: '\\' },
      ],
      testLevel
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/Duplicate/)
  })
})

describe('computeScore', () => {
  it('returns a positive score for an empty mirror set', () => {
    const score = computeScore([], testLevel)
    expect(score).toBeGreaterThan(0)
  })

  it('agrees with client-side calculateScore for the same mirrors', () => {
    const mirrors: Mirror[] = [
      { position: { x: 2, y: 2 }, type: '/' },
    ]
    const serverScore = computeScore(mirrors, testLevel)

    // Client-side computation
    const laserConfig = JSON.parse(testLevel.laserConfig)
    const obstacles = JSON.parse(testLevel.obstacles)
    const path = calculateLaserPath(
      laserConfig,
      mirrors,
      obstacles,
      { width: testLevel.gridWidth, height: testLevel.gridHeight }
    )
    const clientScore = calculateScore(path)

    expect(serverScore).toBe(clientScore)
  })
})

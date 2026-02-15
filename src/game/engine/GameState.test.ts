import {
  createInitialGameState,
  canPlaceMirror,
  placeMirror,
  removeMirror,
  toggleMirrorType,
  setSelectedMirrorType,
  resetGame,
  loadSolution,
  completeGame,
} from './GameState'
import { LevelConfig, Mirror } from '../types'

// Minimal 5x5 level for testing
const testLevel: LevelConfig = {
  gridWidth: 5,
  gridHeight: 5,
  laserConfig: { x: -1, y: 2, direction: 'right' },
  obstacles: [{ x: 4, y: 4 }],
  mirrorsAvailable: 3,
  optimalScore: 10,
}

describe('createInitialGameState', () => {
  it('returns state with no mirrors and a computed laser path', () => {
    const state = createInitialGameState(testLevel)

    expect(state.placedMirrors).toEqual([])
    expect(state.laserPath).not.toBeNull()
    expect(state.selectedMirrorType).toBe('/')
    expect(state.isComplete).toBe(false)
    expect(state.score).toBeGreaterThan(0)
    expect(state.level).toBe(testLevel)
  })
})

describe('canPlaceMirror', () => {
  const state = createInitialGameState(testLevel)

  it('accepts a valid position', () => {
    expect(canPlaceMirror(state, { x: 2, y: 2 })).toBe(true)
  })

  it('rejects out of bounds (negative)', () => {
    expect(canPlaceMirror(state, { x: -1, y: 0 })).toBe(false)
  })

  it('rejects out of bounds (too large)', () => {
    expect(canPlaceMirror(state, { x: 5, y: 0 })).toBe(false)
  })

  it('rejects placement on obstacle', () => {
    expect(canPlaceMirror(state, { x: 4, y: 4 })).toBe(false)
  })

  it('rejects duplicate position', () => {
    const withMirror = placeMirror(state, { x: 2, y: 2 }, '/')
    expect(canPlaceMirror(withMirror, { x: 2, y: 2 })).toBe(false)
  })

  it('rejects when mirror limit reached', () => {
    let s = state
    s = placeMirror(s, { x: 0, y: 0 }, '/')
    s = placeMirror(s, { x: 1, y: 0 }, '/')
    s = placeMirror(s, { x: 2, y: 0 }, '/')
    // 3 mirrors placed, limit is 3
    expect(canPlaceMirror(s, { x: 3, y: 0 })).toBe(false)
  })
})

describe('placeMirror', () => {
  it('adds a mirror and recalculates the laser path', () => {
    const state = createInitialGameState(testLevel)
    const result = placeMirror(state, { x: 2, y: 2 }, '/')

    expect(result.placedMirrors).toHaveLength(1)
    expect(result.placedMirrors[0]).toEqual({
      position: { x: 2, y: 2 },
      type: '/',
    })
    expect(result.laserPath).not.toBeNull()
    expect(result.score).toBeGreaterThan(0)
  })

  it('returns same state for invalid placement', () => {
    const state = createInitialGameState(testLevel)
    const result = placeMirror(state, { x: -1, y: 0 }, '/')
    expect(result).toBe(state)
  })
})

describe('removeMirror', () => {
  it('removes a mirror and recalculates', () => {
    const state = createInitialGameState(testLevel)
    const withMirror = placeMirror(state, { x: 2, y: 2 }, '/')
    const result = removeMirror(withMirror, { x: 2, y: 2 })

    expect(result.placedMirrors).toHaveLength(0)
    expect(result.score).toBe(state.score)
  })

  it('returns same state if no mirror at position', () => {
    const state = createInitialGameState(testLevel)
    const result = removeMirror(state, { x: 2, y: 2 })
    expect(result).toBe(state)
  })
})

describe('toggleMirrorType', () => {
  it('flips / to \\', () => {
    const state = createInitialGameState(testLevel)
    const withMirror = placeMirror(state, { x: 2, y: 2 }, '/')
    const toggled = toggleMirrorType(withMirror, { x: 2, y: 2 })

    expect(toggled.placedMirrors[0].type).toBe('\\')
  })

  it('flips \\ to /', () => {
    const state = createInitialGameState(testLevel)
    const withMirror = placeMirror(state, { x: 2, y: 2 }, '\\')
    const toggled = toggleMirrorType(withMirror, { x: 2, y: 2 })

    expect(toggled.placedMirrors[0].type).toBe('/')
  })

  it('returns same state if no mirror at position', () => {
    const state = createInitialGameState(testLevel)
    const result = toggleMirrorType(state, { x: 2, y: 2 })
    expect(result).toBe(state)
  })
})

describe('setSelectedMirrorType', () => {
  it('updates the selected mirror type', () => {
    const state = createInitialGameState(testLevel)
    const result = setSelectedMirrorType(state, '\\')
    expect(result.selectedMirrorType).toBe('\\')
  })
})

describe('resetGame', () => {
  it('clears all mirrors and returns to initial state', () => {
    const state = createInitialGameState(testLevel)
    const withMirror = placeMirror(state, { x: 2, y: 2 }, '/')
    const reset = resetGame(withMirror)

    expect(reset.placedMirrors).toEqual([])
    expect(reset.score).toBe(state.score)
    expect(reset.isComplete).toBe(false)
  })
})

describe('loadSolution', () => {
  it('loads a set of mirrors and recalculates', () => {
    const state = createInitialGameState(testLevel)
    const mirrors: Mirror[] = [
      { position: { x: 1, y: 2 }, type: '/' },
      { position: { x: 3, y: 2 }, type: '\\' },
    ]
    const result = loadSolution(state, mirrors)

    expect(result.placedMirrors).toBe(mirrors)
    expect(result.laserPath).not.toBeNull()
    expect(result.score).not.toBe(state.score)
  })
})

describe('completeGame', () => {
  it('marks the game as complete', () => {
    const state = createInitialGameState(testLevel)
    const result = completeGame(state)
    expect(result.isComplete).toBe(true)
  })
})

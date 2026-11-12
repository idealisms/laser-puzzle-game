import { computeAchievements } from './achievements'
import { calculateLaserPath } from './engine/simulate'
import { Direction, LaserPath, Mirror, Obstacle, OptimalMirror } from './types'

function mirror(x: number, y: number, type: '/' | '\\' = '/'): Mirror {
  return { position: { x, y }, type }
}

function optimal(x: number, y: number, type: '/' | '\\' = '/'): OptimalMirror {
  return { x, y, type }
}

function laserPathWithRun(direction: LaserPath['streams'][0]['segments'][0]['direction'], length: number): LaserPath {
  const segments = Array.from({ length }, (_, i) => ({
    start: { x: 0, y: i },
    end: { x: 0, y: i + 1 },
    direction,
  }))
  return {
    streams: [{ segments, generation: 0 }],
    totalLength: length,
    terminated: true,
    terminationReason: 'edge',
    collisionPoints: [],
  }
}

// Builds a single-stream laser path where each entry becomes a unit-length segment
// in that direction, so a direction change between consecutive entries is a "turn".
function laserPathWithDirections(directions: Direction[]): LaserPath {
  const segments = directions.map((direction, i) => ({
    start: { x: i, y: 0 },
    end: { x: i + 1, y: 0 },
    direction,
  }))
  return {
    streams: [{ segments, generation: 0 }],
    totalLength: directions.length,
    terminated: true,
    terminationReason: 'edge',
    collisionPoints: [],
  }
}

const baseCtx = {
  score: 10,
  optimalScore: 20,
  mirrors: [] as Mirror[],
  mirrorsAvailable: 10,
  optimalSolution: undefined as OptimalMirror[] | undefined,
  laserPath: null as LaserPath | null,
  playedPreviousDay: false,
  averagePercentage: null as number | null,
  timeSpentSeconds: null as number | null,
  mirrorsErased: null as number | null,
  resetCount: null as number | null,
}

describe('computeAchievements', () => {
  it('awards Perfect Score and Matching Solution for an exact optimal match', () => {
    const optimalSolution = [optimal(1, 1), optimal(2, 2, '\\')]
    const achievements = computeAchievements({
      ...baseCtx,
      score: 20,
      optimalScore: 20,
      mirrors: [mirror(1, 1), mirror(2, 2, '\\')],
      optimalSolution,
    })
    const ids = achievements.map((a) => a.id)
    expect(ids).toContain('perfect-score')
    expect(ids).toContain('matching-solution')
    expect(ids).not.toContain('different-solution')
  })

  it('awards Different Solution when perfect but mirrors differ', () => {
    const optimalSolution = [optimal(1, 1), optimal(2, 2, '\\')]
    const achievements = computeAchievements({
      ...baseCtx,
      score: 20,
      optimalScore: 20,
      mirrors: [mirror(5, 5), mirror(6, 6, '\\')],
      optimalSolution,
    })
    const ids = achievements.map((a) => a.id)
    expect(ids).toContain('different-solution')
    expect(ids).not.toContain('matching-solution')
  })

  it('awards Better than me when score exceeds optimal', () => {
    const achievements = computeAchievements({ ...baseCtx, score: 25, optimalScore: 20 })
    expect(achievements.map((a) => a.id)).toContain('better-than-me')
  })

  it('awards Better than Average only when above the average', () => {
    const above = computeAchievements({ ...baseCtx, score: 15, optimalScore: 20, averagePercentage: 50 })
    const below = computeAchievements({ ...baseCtx, score: 5, optimalScore: 20, averagePercentage: 50 })
    expect(above.map((a) => a.id)).toContain('better-than-average')
    expect(below.map((a) => a.id)).not.toContain('better-than-average')
  })

  it('counts matching mirror positions regardless of type, capped at 10', () => {
    const optimalSolution = Array.from({ length: 12 }, (_, i) => optimal(i, 0))
    const mirrors = Array.from({ length: 11 }, (_, i) => mirror(i, 0, '\\'))
    const achievements = computeAchievements({ ...baseCtx, mirrors, optimalSolution })
    const matching = achievements.find((a) => a.id === 'matching-mirrors')
    expect(matching?.emoji).toBe('🔟')
  })

  it('awards Streak only when the previous day was played', () => {
    const achievements = computeAchievements({ ...baseCtx, playedPreviousDay: true })
    expect(achievements.map((a) => a.id)).toContain('streak')
  })

  it('awards Forgot something when fewer mirrors were placed than available', () => {
    const achievements = computeAchievements({
      ...baseCtx,
      mirrors: [mirror(0, 0)],
      mirrorsAvailable: 5,
    })
    expect(achievements.map((a) => a.id)).toContain('forgot-something')
  })

  it('does not award Forgot something when all mirrors were placed', () => {
    const mirrors = [mirror(0, 0), mirror(1, 1)]
    const achievements = computeAchievements({ ...baseCtx, mirrors, mirrorsAvailable: 2 })
    expect(achievements.map((a) => a.id)).not.toContain('forgot-something')
  })

  it('awards Long path for a run of 20+ same-direction segments', () => {
    const achievements = computeAchievements({ ...baseCtx, laserPath: laserPathWithRun('down', 20) })
    expect(achievements.map((a) => a.id)).toContain('long-path')
  })

  it('does not award Long path for a run shorter than 20', () => {
    const achievements = computeAchievements({ ...baseCtx, laserPath: laserPathWithRun('down', 19) })
    expect(achievements.map((a) => a.id)).not.toContain('long-path')
  })

  it('awards Finished in under a minute for a fast submission', () => {
    const achievements = computeAchievements({ ...baseCtx, timeSpentSeconds: 59 })
    expect(achievements.map((a) => a.id)).toContain('fast-finish')
  })

  it('does not award Finished in under a minute at or above 60 seconds', () => {
    const achievements = computeAchievements({ ...baseCtx, timeSpentSeconds: 60 })
    expect(achievements.map((a) => a.id)).not.toContain('fast-finish')
  })

  it('awards Took your time on this one for a submission over 5 minutes', () => {
    const achievements = computeAchievements({ ...baseCtx, timeSpentSeconds: 301 })
    expect(achievements.map((a) => a.id)).toContain('slow-finish')
  })

  it('does not award Took your time on this one at or under 5 minutes', () => {
    const achievements = computeAchievements({ ...baseCtx, timeSpentSeconds: 300 })
    expect(achievements.map((a) => a.id)).not.toContain('slow-finish')
  })

  it('does not award fast/slow finish when timeSpentSeconds is unavailable', () => {
    const achievements = computeAchievements({ ...baseCtx, timeSpentSeconds: null })
    const ids = achievements.map((a) => a.id)
    expect(ids).not.toContain('fast-finish')
    expect(ids).not.toContain('slow-finish')
  })

  it('awards No mirrors removed when nothing was erased or reset', () => {
    const achievements = computeAchievements({ ...baseCtx, mirrorsErased: 0, resetCount: 0 })
    expect(achievements.map((a) => a.id)).toContain('no-mirrors-removed')
  })

  it('does not award No mirrors removed if anything was erased or reset', () => {
    const erased = computeAchievements({ ...baseCtx, mirrorsErased: 1, resetCount: 0 })
    const reset = computeAchievements({ ...baseCtx, mirrorsErased: 0, resetCount: 1 })
    expect(erased.map((a) => a.id)).not.toContain('no-mirrors-removed')
    expect(reset.map((a) => a.id)).not.toContain('no-mirrors-removed')
  })

  it('does not award No mirrors removed when the stats are unavailable', () => {
    const achievements = computeAchievements({ ...baseCtx, mirrorsErased: null, resetCount: null })
    expect(achievements.map((a) => a.id)).not.toContain('no-mirrors-removed')
  })

  it('awards Tried a different path when reset was pressed at least once', () => {
    const achievements = computeAchievements({ ...baseCtx, resetCount: 1 })
    expect(achievements.map((a) => a.id)).toContain('tried-different-path')
  })

  it('does not award Tried a different path when reset was never pressed', () => {
    const achievements = computeAchievements({ ...baseCtx, resetCount: 0 })
    expect(achievements.map((a) => a.id)).not.toContain('tried-different-path')
  })

  it('awards Right turns only when every turn is clockwise', () => {
    // up -> right (CW) -> down (CW) -> left (CW) -> up (CW)
    const laserPath = laserPathWithDirections(['up', 'right', 'down', 'left', 'up'])
    const achievements = computeAchievements({ ...baseCtx, laserPath })
    const ids = achievements.map((a) => a.id)
    expect(ids).toContain('right-turns-only')
    expect(ids).not.toContain('left-turns-only')
  })

  it('awards Left turns only when every turn is counter-clockwise', () => {
    // up -> left (CCW) -> down (CCW) -> right (CCW) -> up (CCW)
    const laserPath = laserPathWithDirections(['up', 'left', 'down', 'right', 'up'])
    const achievements = computeAchievements({ ...baseCtx, laserPath })
    const ids = achievements.map((a) => a.id)
    expect(ids).toContain('left-turns-only')
    expect(ids).not.toContain('right-turns-only')
  })

  it('awards neither turn achievement when turns are mixed', () => {
    const laserPath = laserPathWithDirections(['up', 'right', 'up', 'left'])
    const achievements = computeAchievements({ ...baseCtx, laserPath })
    const ids = achievements.map((a) => a.id)
    expect(ids).not.toContain('right-turns-only')
    expect(ids).not.toContain('left-turns-only')
  })

  it('awards neither turn achievement when the path never turns', () => {
    const laserPath = laserPathWithDirections(['right', 'right', 'right'])
    const achievements = computeAchievements({ ...baseCtx, laserPath })
    const ids = achievements.map((a) => a.id)
    expect(ids).not.toContain('right-turns-only')
    expect(ids).not.toContain('left-turns-only')
  })

  it('awards Equal mirror types when slash and backslash counts match', () => {
    const mirrors = [mirror(0, 0, '/'), mirror(1, 1, '\\'), mirror(2, 2, '/'), mirror(3, 3, '\\')]
    const achievements = computeAchievements({ ...baseCtx, mirrors })
    expect(achievements.map((a) => a.id)).toContain('equal-mirror-types')
  })

  it('does not award Equal mirror types when counts differ', () => {
    const mirrors = [mirror(0, 0, '/'), mirror(1, 1, '/'), mirror(2, 2, '\\')]
    const achievements = computeAchievements({ ...baseCtx, mirrors })
    expect(achievements.map((a) => a.id)).not.toContain('equal-mirror-types')
  })

  it('does not award Equal mirror types with no mirrors placed', () => {
    const achievements = computeAchievements({ ...baseCtx, mirrors: [] })
    expect(achievements.map((a) => a.id)).not.toContain('equal-mirror-types')
  })
})

// Splitter and portal badges, on real boards traced by the engine.
describe('splitter and portal achievements', () => {
  function ids(
    laser: { x: number; y: number; direction: Direction },
    mirrors: Mirror[],
    obstacles: Obstacle[],
    size = { width: 9, height: 9 }
  ): string[] {
    const laserPath = calculateLaserPath(laser, mirrors, obstacles, size)
    return computeAchievements({ ...baseCtx, mirrors, laserPath, obstacles }).map((a) => a.id)
  }

  // Splits at (3,2); the down beam turns right at (3,6) into a second splitter at (6,6).
  const twoSplitters = (secondOrientation: 'right' | 'left'): Obstacle[] => [
    { x: 3, y: 2, type: 'splitter', orientation: 'right' },
    { x: 6, y: 6, type: 'splitter', orientation: secondOrientation },
  ]
  const toSecondSplitter = [mirror(3, 6, '\\')]
  const fromLeft = { x: 0, y: 2, direction: 'right' as const }

  it('Full spectrum: every splitter on a two-splitter board splits', () => {
    expect(ids(fromLeft, toSecondSplitter, twoSplitters('right'))).toContain('full-spectrum')
  })

  it('no Full spectrum when only one of two splitters splits', () => {
    const result = ids(fromLeft, toSecondSplitter, twoSplitters('left')) // hits the back of the second
    expect(result).not.toContain('full-spectrum')
    expect(result).not.toContain('didnt-split')
  })

  it('no Full spectrum on a one-splitter board', () => {
    expect(ids(fromLeft, [], [{ x: 3, y: 2, type: 'splitter', orientation: 'right' }])).not.toContain('full-spectrum')
  })

  it("Didn't split: the board has a splitter the beam never splits at", () => {
    expect(ids({ x: 0, y: 0, direction: 'right' }, [], [{ x: 3, y: 3, type: 'splitter', orientation: 'right' }])).toContain(
      'didnt-split'
    )
    // Hitting a side turns the beam without splitting it: still counts.
    expect(
      ids({ x: 0, y: 0, direction: 'right' }, [mirror(3, 0, '\\')], [{ x: 3, y: 3, type: 'splitter', orientation: 'right' }])
    ).toContain('didnt-split')
  })

  it("no Didn't split on a board without splitters", () => {
    expect(ids(fromLeft, [], [])).not.toContain('didnt-split')
  })

  it('Collision course: split beams sent back at each other', () => {
    const mirrors = [mirror(3, 0, '/'), mirror(6, 0, '\\'), mirror(3, 4, '\\'), mirror(6, 4, '/')]
    const result = ids(fromLeft, mirrors, [{ x: 3, y: 2, type: 'splitter', orientation: 'right' }], { width: 7, height: 5 })
    expect(result).toContain('collision-course')
  })

  it('no Collision course when nothing collides', () => {
    expect(ids(fromLeft, [], [{ x: 3, y: 2, type: 'splitter', orientation: 'right' }])).not.toContain('collision-course')
  })

  // Portal pair at (2,1) and (6,1), with a wall between them.
  const portals: Obstacle[] = [
    { x: 2, y: 1, type: 'portal', pair: 1 },
    { x: 6, y: 1, type: 'portal', pair: 1 },
  ]
  const intoPortal = { x: 0, y: 1, direction: 'right' as const }

  it('Round trip: through the pair one way, then back the other way', () => {
    // Out of (6,1) heading right, down at (7,1), left at (7,4), up at (6,4), back
    // into (6,1) heading up, and out of (2,1).
    const mirrors = [mirror(7, 1, '\\'), mirror(7, 4, '/'), mirror(6, 4, '\\')]
    const result = ids(intoPortal, mirrors, portals)
    expect(result).toContain('round-trip')
    expect(result).not.toContain('cake-is-a-lie')
  })

  it('no Round trip when the portals are used only one way', () => {
    const result = ids(intoPortal, [], portals)
    expect(result).not.toContain('round-trip')
    expect(result).not.toContain('cake-is-a-lie')
  })

  it('The cake is a lie: the board has portals and the beam skips them', () => {
    const result = ids({ x: 0, y: 5, direction: 'right' }, [], portals)
    expect(result).toContain('cake-is-a-lie')
    expect(result).not.toContain('round-trip')
  })

  it('no portal badges on a board without portals', () => {
    const result = ids(fromLeft, [], [])
    expect(result).not.toContain('cake-is-a-lie')
    expect(result).not.toContain('round-trip')
  })
})

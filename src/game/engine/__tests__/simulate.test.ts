import { calculateLaserPath, sameCellCollision } from '../simulate'
import { Direction, LaserConfig, LaserPath, Mirror, Obstacle } from '../../types'

// Mirror reflection reference:
//   '\': right→down, up→left, left→up, down→right
//   '/': right→up,   down→left, left→down, up→right

const BOUNDS_15x20 = { width: 15, height: 20 }
const BOUNDS_10x10 = { width: 10, height: 10 }

function mirror(x: number, y: number, type: '/' | '\\'): Mirror {
  return { position: { x, y }, type }
}

function splitter(x: number, y: number, orientation: 'right' | 'left' | 'up' | 'down'): Obstacle {
  return { x, y, type: 'splitter', orientation }
}

function wall(x: number, y: number): Obstacle {
  return { x, y }
}

// ─────────────────────────────────────────────────────────────────────────────
// sameCellCollision — two beams arriving at one cell at the same time
// ─────────────────────────────────────────────────────────────────────────────

describe('sameCellCollision', () => {
  const at = { x: 5, y: 5 }
  const collide = (a: Direction, b: Direction, mirrors: Mirror[] = [], obstacles: Obstacle[] = []) =>
    sameCellCollision(at, a, b, mirrors, obstacles)

  it('open space: head-on beams collide', () => {
    expect(collide('right', 'left')).toBe(true)
    expect(collide('up', 'down')).toBe(true)
  })

  it('open space: same-direction beams collide', () => {
    expect(collide('right', 'right')).toBe(true)
  })

  it('open space: perpendicular beams pass through each other', () => {
    for (const [a, b] of [['up', 'right'], ['up', 'left'], ['down', 'right'], ['down', 'left']] as [Direction, Direction][]) {
      expect(collide(a, b)).toBe(false)
    }
  })

  it("'/' mirror: beams on the same face collide, opposite faces don't", () => {
    const m = [mirror(5, 5, '/')]
    expect(collide('right', 'down', m)).toBe(true)  // both on face {right, down}
    expect(collide('right', 'left', m)).toBe(false)
    expect(collide('down', 'up', m)).toBe(false)
  })

  it("'\\' mirror: beams on the same face collide, opposite faces don't", () => {
    const m = [mirror(5, 5, '\\')]
    expect(collide('right', 'up', m)).toBe(true)    // both on face {up, right}
    expect(collide('up', 'down', m)).toBe(false)
  })

  it('splitter: a beam hitting the wall face just stops, no collision', () => {
    // orientation 'right' → wall face is hit by a beam travelling LEFT
    expect(collide('right', 'left', [], [splitter(5, 5, 'right')])).toBe(false)
  })

  it('splitter: two beams on reflect faces collide', () => {
    expect(collide('up', 'down', [], [splitter(5, 5, 'right')])).toBe(true)
  })
})

/**
 * Every split beam must start where, and when, a beam that was still alive
 * reached a splitter: its parent's last step ends at the child's start cell
 * at time child.globalOffset.
 */
function expectNoOrphanBeams(result: LaserPath) {
  for (const child of result.streams.filter((s) => s.generation > 0)) {
    const start = child.segments[0].start
    const parent = result.streams.find((p) => {
      if (p.generation !== child.generation - 1) return false
      const last = p.segments[p.segments.length - 1]
      return (p.globalOffset ?? 0) + p.segments.length === child.globalOffset &&
        last.end.x === start.x && last.end.y === start.y
    })
    expect(parent).toBeDefined()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateLaserPath — simple beam tests (no splitters)
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateLaserPath — straight beams', () => {
  it('horizontal beam exits right edge', () => {
    // 10-wide grid, laser at x=0 going right → 10 steps to exit
    const laser: LaserConfig = { x: 0, y: 5, direction: 'right' }
    const result = calculateLaserPath(laser, [], [], BOUNDS_10x10)
    expect(result.totalLength).toBe(10)
    expect(result.terminationReason).toBe('edge')
  })

  it('vertical beam exits top edge', () => {
    // 10-tall grid, laser at y=9 going up → 10 steps to exit
    const laser: LaserConfig = { x: 5, y: 9, direction: 'up' }
    const result = calculateLaserPath(laser, [], [], BOUNDS_10x10)
    expect(result.totalLength).toBe(10)
    expect(result.terminationReason).toBe('edge')
  })

  it('laser at edge cell exits immediately', () => {
    // Laser at last column going right exits in 1 step
    const laser: LaserConfig = { x: 4, y: 2, direction: 'right' }
    const result = calculateLaserPath(laser, [], [], { width: 5, height: 5 })
    expect(result.totalLength).toBe(1)
    expect(result.terminationReason).toBe('edge')
  })

  it('wall obstacle stops the beam', () => {
    // Laser at (0,5) going right; wall at (5,5) — 5 steps (the step onto the wall is counted)
    const laser: LaserConfig = { x: 0, y: 5, direction: 'right' }
    const result = calculateLaserPath(laser, [], [wall(5, 5)], BOUNDS_10x10)
    expect(result.totalLength).toBe(5)
    expect(result.terminationReason).toBe('obstacle')
  })

  it('wall immediately in front — 1 step', () => {
    const laser: LaserConfig = { x: 0, y: 5, direction: 'right' }
    const result = calculateLaserPath(laser, [], [wall(1, 5)], BOUNDS_10x10)
    expect(result.totalLength).toBe(1)
    expect(result.terminationReason).toBe('obstacle')
  })

  it('slash mirror redirects right to up', () => {
    // '/' mirror at (4,5): incoming RIGHT → exits UP.
    // 4 steps going right, then (4,4)→…→(4,-1) = 6 steps up. Total = 10.
    const laser: LaserConfig = { x: 0, y: 5, direction: 'right' }
    const result = calculateLaserPath(laser, [mirror(4, 5, '/')], [], BOUNDS_10x10)
    expect(result.totalLength).toBe(10)
  })

  it('backslash mirror redirects right to down', () => {
    // '\\' mirror at (4,5): incoming RIGHT → exits DOWN.
    // 4 steps right, then (4,6)→…→(4,10) = 5 steps down. Total = 9.
    const laser: LaserConfig = { x: 0, y: 5, direction: 'right' }
    const result = calculateLaserPath(laser, [mirror(4, 5, '\\')], [], BOUNDS_10x10)
    expect(result.totalLength).toBe(9)
  })

  it('loop detection: four mirrors forming a closed rectangle', () => {
    // '\\' at (5,3): right→down  (top-right corner)
    // '/'  at (5,6): down→left   (bottom-right corner)
    // '\\' at (2,6): left→up     (bottom-left corner)
    // '/'  at (2,3): up→right    (top-left corner)
    const laser: LaserConfig = { x: 3, y: 3, direction: 'right' }
    const mirrors = [
      mirror(5, 3, '\\'), mirror(5, 6, '/'), mirror(2, 6, '\\'), mirror(2, 3, '/'),
    ]
    const result = calculateLaserPath(laser, mirrors, [], { width: 8, height: 8 })
    expect(result.terminationReason).toBe('loop')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calculateLaserPath — splitter tests (no collision)
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateLaserPath — splitters', () => {
  it('splitter wall: laser hits hypotenuse face — blocked', () => {
    // Splitter at (5,5) orientation='left'; laser going RIGHT → hits opposite face → wall
    const laser: LaserConfig = { x: 0, y: 5, direction: 'right' }
    const result = calculateLaserPath(laser, [], [splitter(5, 5, 'left')], BOUNDS_10x10)
    expect(result.totalLength).toBe(5)
    expect(result.terminationReason).toBe('obstacle')
  })

  it('splitter reflect: perpendicular hit reflects toward opposite of orientation', () => {
    // Splitter at (5,5) orientation='up'; RIGHT is perpendicular → reflects toward DOWN.
    // 5 steps right + 5 steps down to exit = 10
    const laser: LaserConfig = { x: 0, y: 5, direction: 'right' }
    const result = calculateLaserPath(laser, [], [splitter(5, 5, 'up')], BOUNDS_10x10)
    expect(result.totalLength).toBe(10)
  })

  it('splitter split: both sub-beams count toward total length', () => {
    // Splitter at (5,7) orientation='right' in 15x15.
    // Laser at (0,7) going right: 5 steps to splitter (offset=5).
    // UP beam: 8 steps to top edge; DOWN beam: 8 steps to bottom edge.
    // No collision (they diverge immediately). Total = 5 + 8 + 8 = 21.
    const laser: LaserConfig = { x: 0, y: 7, direction: 'right' }
    const result = calculateLaserPath(laser, [], [splitter(5, 7, 'right')], { width: 15, height: 15 })
    expect(result.totalLength).toBe(21)
    expect(result.collisionPoints).toHaveLength(0)
  })

  it('splitter split symmetric: down-oriented splitter in rectangular grid', () => {
    // Splitter at (7,4) orientation='down' in 15x10.
    // Laser at (7,0) going down: 4 steps (offset=4).
    // LEFT beam: 8 steps to exit; RIGHT beam: 8 steps to exit. Total = 4 + 8 + 8 = 20.
    const laser: LaserConfig = { x: 7, y: 0, direction: 'down' }
    const result = calculateLaserPath(laser, [], [splitter(7, 4, 'down')], { width: 15, height: 10 })
    expect(result.totalLength).toBe(20)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calculateLaserPath — collision detection integration tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateLaserPath — collision detection', () => {
  it('no collision: straight beam with no splitter', () => {
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const result = calculateLaserPath(laser, [], [], BOUNDS_15x20)
    expect(result.collisionPoints).toHaveLength(0)
  })

  it('no collision: splitter creates perpendicular beams that never meet head-on', () => {
    // Splitter at (5,10) 'right': primary beam goes right → splits UP and DOWN.
    // UP and DOWN diverge and hit the edges without redirecting back.
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const obstacles: Obstacle[] = [splitter(5, 10, 'right')]
    const result = calculateLaserPath(laser, [], obstacles, BOUNDS_15x20)
    expect(result.collisionPoints).toHaveLength(0)
  })

  it('same-cell collision: symmetric loop where both beams meet at one cell', () => {
    // Layout (15×20, laser at (0,10) going right):
    //   Splitter at (5,10) 'right' → UP beam and DOWN beam
    //   UP beam:   goes up 4 cells to (5,6) → '/' mirror → goes right →
    //              '\' mirror at (10,6) → goes down
    //   DOWN beam: goes down 4 cells to (5,14) → '\' mirror → goes right →
    //              '/' mirror at (10,14) → goes up
    //   Both start heading toward each other at the same global time.
    //   Gap between rows 6 and 14 = 8 (even) → they meet at row 10, col 10.
    //   Primary: 5 segs; UP/DOWN each: 4 + 5 + 4 = 13 segs. Total = 5 + 13 + 13 = 31.
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const obstacles: Obstacle[] = [splitter(5, 10, 'right')]
    const mirrors: Mirror[] = [
      mirror(5, 6,  '/'),   // UP beam going up hits → goes right
      mirror(10, 6, '\\'),  // UP beam going right hits → goes down
      mirror(5, 14, '\\'),  // DOWN beam going down hits → goes right
      mirror(10, 14, '/'),  // DOWN beam going right hits → goes up
    ]
    const result = calculateLaserPath(laser, mirrors, obstacles, BOUNDS_15x20)
    expect(result.collisionPoints).toHaveLength(1)
    expect(result.collisionPoints[0]).toEqual({ x: 10, y: 10 })
    expect(result.totalLength).toBe(31)
  })

  it('crossing collision: asymmetric beams, same-cell collision at (10,9)', () => {
    // Same rig as above but DOWN beam uses mirror at (5,13) instead of (5,14).
    // Same-cell collision at (10,9) at the same global time.
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const obstacles: Obstacle[] = [splitter(5, 10, 'right')]
    const mirrors: Mirror[] = [
      mirror(5, 6,  '/'),
      mirror(10, 6, '\\'),
      mirror(5, 13, '\\'),
      mirror(10, 13, '/'),
    ]
    const result = calculateLaserPath(laser, mirrors, obstacles, BOUNDS_15x20)
    expect(result.collisionPoints).toHaveLength(1)
    expect(result.collisionPoints[0]).toEqual({ x: 10, y: 9 })
  })

  it('no collision: two beams hit same mirror at different times', () => {
    // UP and DOWN arms go straight → they exit opposite edges, no collision.
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const obstacles: Obstacle[] = [splitter(5, 10, 'right')]
    const result = calculateLaserPath(laser, [], obstacles, BOUNDS_15x20)
    expect(result.collisionPoints).toHaveLength(0)
  })

  it('totalLength counts segments per stream (collision cells counted per beam)', () => {
    // Same-cell collision: UP and DOWN both end at (10,10).
    // (10,10) counted once per stream → segment sum equals totalLength.
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const obstacles: Obstacle[] = [splitter(5, 10, 'right')]
    const mirrors: Mirror[] = [
      mirror(5, 6,  '/'),
      mirror(10, 6, '\\'),
      mirror(5, 14, '\\'),
      mirror(10, 14, '/'),
    ]
    const result = calculateLaserPath(laser, mirrors, obstacles, BOUNDS_15x20)
    const segmentSum = result.streams.reduce((s, st) => s + st.segments.length, 0)
    expect(result.totalLength).toBe(segmentSum)
  })

  it('collision scenario from solver test: total length 26 with four mirrors', () => {
    // 13×13 grid, laser at (0,6) going RIGHT, splitter at (6,6) orientation='right'.
    // Mirrors route both sub-beams to converge at (10,6):
    //   '/'  at (6,3) : UP   → RIGHT
    //   '\\' at (10,3): RIGHT → DOWN
    //   '\\' at (6,9) : DOWN  → RIGHT
    //   '/'  at (10,9): RIGHT → UP
    // After collision truncation: 6 (primary) + 10 (UP) + 10 (DOWN) = 26.
    const laser: LaserConfig = { x: 0, y: 6, direction: 'right' }
    const obstacles: Obstacle[] = [splitter(6, 6, 'right')]
    const mirrors: Mirror[] = [
      mirror(6, 3,  '/'),
      mirror(10, 3, '\\'),
      mirror(6, 9,  '\\'),
      mirror(10, 9, '/'),
    ]
    const result = calculateLaserPath(laser, mirrors, obstacles, { width: 13, height: 13 })
    expect(result.totalLength).toBe(26)
  })

  it('collision scenario: no mirrors → no collision, total = 20', () => {
    // Same setup without mirrors: 6 primary + 7 UP + 7 DOWN = 20.
    const laser: LaserConfig = { x: 0, y: 6, direction: 'right' }
    const obstacles: Obstacle[] = [splitter(6, 6, 'right')]
    const result = calculateLaserPath(laser, [], obstacles, { width: 13, height: 13 })
    expect(result.totalLength).toBe(20)
    expect(result.collisionPoints).toHaveLength(0)
  })

  it('collision scenario: partial mirrors — only UP beam redirected, total = 23', () => {
    // Only '/' at (6,3): UP beam turns right but DOWN goes straight.
    // 6 (primary) + 3+7 (UP) + 7 (DOWN) = 23.
    const laser: LaserConfig = { x: 0, y: 6, direction: 'right' }
    const obstacles: Obstacle[] = [splitter(6, 6, 'right')]
    const mirrors: Mirror[] = [mirror(6, 3, '/')]
    const result = calculateLaserPath(laser, mirrors, obstacles, { width: 13, height: 13 })
    expect(result.totalLength).toBe(23)
  })

  it('collision at splitter: two beams on reflect faces should collide', () => {
    // Grid 15×20. Splitter B at (5,10) 'right' splits the primary beam (0,10 →RIGHT)
    // into UP and DOWN sub-beams at gTime=5. Splitter A at (13,10) 'right' is the
    // collision target.
    //
    // UP sub-beam (offset=5) — arrives at A going DOWN (reflect face):
    //   '/' at (5,6):  UP→RIGHT
    //   '\\' at (13,6): RIGHT→DOWN  → arrives at A going DOWN at gTime=21
    //
    // DOWN sub-beam (offset=5) — arrives at A going UP (reflect face):
    //   '\\' at (5,14): DOWN→RIGHT
    //   '/' at (13,14): RIGHT→UP   → arrives at A going UP at gTime=21
    //
    // DOWN and UP are both non-wall faces of the 'right'-oriented splitter A
    // (wall face = LEFT). Both beams reflect to LEFT after A; they quickly reach B's
    // wall face and stop. No secondary collisions.
    //
    // After truncation: primary(5) + UP-beam(16) + DOWN-beam(16) = 37 total.
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const obstacles: Obstacle[] = [
      splitter(5,  10, 'right'),  // B: splits primary beam UP+DOWN
      splitter(13, 10, 'right'),  // A: collision target
    ]
    const mirrors: Mirror[] = [
      mirror(5,  6,  '/'),   // UP beam:   UP → RIGHT
      mirror(13, 6,  '\\'),  // UP beam:   RIGHT → DOWN  (arrives at A going DOWN)
      mirror(5,  14, '\\'),  // DOWN beam: DOWN → RIGHT
      mirror(13, 14, '/'),   // DOWN beam: RIGHT → UP    (arrives at A going UP)
    ]
    const result = calculateLaserPath(laser, mirrors, obstacles, BOUNDS_15x20)
    expect(result.collisionPoints).toHaveLength(1)
    expect(result.collisionPoints[0]).toEqual({ x: 13, y: 10 })
  })

  it('beams that collide stop there and spawn nothing afterwards', () => {
    // Solution from 2026-03-19. The split at (9,15) sends one beam right and one
    // left; both loop round and meet head-on at (11,11) at t=82. Before the fix
    // the left-going beam kept going past the collision to the (5,5) splitter
    // and its two children were counted (145 instead of 94).
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const walls = [
      [2, 2], [3, 2], [3, 3], [4, 3], [2, 3], [10, 1], [11, 1], [11, 2], [12, 2], [10, 2],
      [1, 7], [2, 7], [2, 8], [1, 8], [3, 8], [3, 9], [11, 6], [12, 6], [12, 7], [13, 7],
      [11, 7], [13, 8], [3, 13], [4, 13], [4, 14], [3, 14], [2, 14], [10, 12], [11, 12],
      [11, 13], [12, 13], [12, 14], [13, 13], [5, 17], [6, 17], [6, 18], [7, 18], [7, 17],
    ]
    const obstacles: Obstacle[] = [
      ...walls.map(([x, y]) => wall(x, y)),
      splitter(5, 5, 'right'),
      splitter(9, 15, 'up'),
    ]
    const mirrors: Mirror[] = [
      mirror(14, 10, '/'), mirror(14, 0, '\\'), mirror(5, 0, '/'), mirror(0, 5, '/'),
      mirror(0, 19, '\\'), mirror(9, 19, '/'), mirror(14, 15, '/'), mirror(6, 15, '\\'),
      mirror(14, 11, '\\'), mirror(6, 11, '/'),
    ]
    const result = calculateLaserPath(laser, mirrors, obstacles, BOUNDS_15x20)
    expect(result.collisionPoints).toEqual([{ x: 11, y: 11 }])
    expect(result.streams.map((st) => st.segments.length)).toEqual([70, 12, 12])
    expect(result.totalLength).toBe(94)
    expectNoOrphanBeams(result)
  })

  it('split beams never outlive their parent (collision rigs)', () => {
    const laser: LaserConfig = { x: 0, y: 10, direction: 'right' }
    const rigs: Mirror[][] = [
      [mirror(5, 6, '/'), mirror(10, 6, '\\'), mirror(5, 14, '\\'), mirror(10, 14, '/')],
      [mirror(5, 6, '/'), mirror(10, 6, '\\'), mirror(5, 13, '\\'), mirror(10, 13, '/')],
    ]
    for (const mirrors of rigs) {
      expectNoOrphanBeams(calculateLaserPath(laser, mirrors, [splitter(5, 10, 'right')], BOUNDS_15x20))
    }
  })
})

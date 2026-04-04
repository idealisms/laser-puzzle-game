import { calculateLaserPath, resolveCollisions } from '../simulate'
import { LaserConfig, LaserStream, Mirror, Obstacle, Position } from '../../types'

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

function seg(x0: number, y0: number, x1: number, y1: number, dir: 'up' | 'down' | 'left' | 'right') {
  return { start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, direction: dir }
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveCollisions — unit tests with hand-crafted streams
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveCollisions', () => {
  it('no collision when streams do not meet', () => {
    // Stream 0: goes right along row 3; Stream 1: goes right along row 7
    const streams: LaserStream[] = [
      { segments: [seg(0,3,1,3,'right'), seg(1,3,2,3,'right')], generation: 0 },
      { segments: [seg(0,7,1,7,'right'), seg(1,7,2,7,'right')], generation: 1 },
    ]
    const offsets = [0, 0]
    const result = resolveCollisions(streams, offsets, [])
    expect(result).toHaveLength(0)
  })

  it('same-cell same-time collision: beams arrive at same cell from opposite directions at the same global time', () => {
    // Stream 0 (offset 0): goes right, arriving at (5,5) at segi=4, gTime=5
    // Stream 1 (offset 0): goes left, arriving at (5,5) at segi=4, gTime=5
    const streams: LaserStream[] = [
      { segments: [seg(1,5,2,5,'right'), seg(2,5,3,5,'right'), seg(3,5,4,5,'right'), seg(4,5,5,5,'right'), seg(5,5,6,5,'right')], generation: 0 },
      { segments: [seg(9,5,8,5,'left'),  seg(8,5,7,5,'left'),  seg(7,5,6,5,'left'),  seg(6,5,5,5,'left'),  seg(5,5,4,5,'left')],  generation: 1 },
    ]
    const offsets = [0, 0]
    const result = resolveCollisions(streams, offsets, [])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 5, y: 5 })
    // Both streams truncated to end at (5,5)
    expect(streams[0].segments).toHaveLength(4)  // segs 0..3, segi=3 is the last kept
    expect(streams[1].segments).toHaveLength(4)
    expect(streams[0].segments[3].end).toEqual({ x: 5, y: 5 })
    expect(streams[1].segments[3].end).toEqual({ x: 5, y: 5 })
  })

  it('crossing collision: beams swap adjacent cells at the same global time', () => {
    // Stream 0 (offset 0): arrives at (5,5) going right at gTime=5 (segi=4)
    // Stream 1 (offset 0): arrives at (6,5) going left  at gTime=5 (segi=4)
    // → A heading to (6,5), B heading to (5,5): they cross between the cells
    const streams: LaserStream[] = [
      { segments: [seg(1,5,2,5,'right'), seg(2,5,3,5,'right'), seg(3,5,4,5,'right'), seg(4,5,5,5,'right'), seg(5,5,6,5,'right')], generation: 0 },
      { segments: [seg(10,5,9,5,'left'), seg(9,5,8,5,'left'),  seg(8,5,7,5,'left'),  seg(7,5,6,5,'left'),  seg(6,5,5,5,'left')],  generation: 1 },
    ]
    const offsets = [0, 0]
    const result = resolveCollisions(streams, offsets, [])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 5.5, y: 5 })  // midpoint between (5,5) and (6,5)
    // Each stream truncated at segi=3 (the segment before the crossing cell)
    expect(streams[0].segments).toHaveLength(4)
    expect(streams[1].segments).toHaveLength(4)
  })

  it('same-direction beams at the same cell and time count as a collision', () => {
    // Both going right along identical paths — same-direction beams share the same
    // point in space at the same time, which counts as a collision under the new rule.
    // First shared cell is (4,5) at gTime=1; both streams truncated there.
    const streams: LaserStream[] = [
      { segments: [seg(3,5,4,5,'right'), seg(4,5,5,5,'right'), seg(5,5,6,5,'right')], generation: 0 },
      { segments: [seg(3,5,4,5,'right'), seg(4,5,5,5,'right'), seg(5,5,6,5,'right')], generation: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 4, y: 5 })
    expect(streams[0].segments).toHaveLength(1)
    expect(streams[1].segments).toHaveLength(1)
  })

  it('mirror-side rule / same side: right + down at a / mirror — collision', () => {
    // RIGHT is on face {right,down}, DOWN is on face {right,down} → same face → collision
    const streams: LaserStream[] = [
      { segments: [seg(1,5,2,5,'right'), seg(2,5,3,5,'right'), seg(3,5,4,5,'right'), seg(4,5,5,5,'right')], generation: 0 },
      { segments: [seg(5,1,5,2,'down'),  seg(5,2,5,3,'down'),  seg(5,3,5,4,'down'),  seg(5,4,5,5,'down')],  generation: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [mirror(5, 5, '/')])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 5, y: 5 })
    expect(streams[0].segments).toHaveLength(4)
    expect(streams[1].segments).toHaveLength(4)
  })

  it('mirror-side rule / opposite sides: right + left at a / mirror — no collision', () => {
    // RIGHT is on face {right,down}, LEFT is on face {up,left} → opposite faces → no collision
    const streams: LaserStream[] = [
      { segments: [seg(1,5,2,5,'right'), seg(2,5,3,5,'right'), seg(3,5,4,5,'right'), seg(4,5,5,5,'right')], generation: 0 },
      { segments: [seg(9,5,8,5,'left'),  seg(8,5,7,5,'left'),  seg(7,5,6,5,'left'),  seg(6,5,5,5,'left')],  generation: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [mirror(5, 5, '/')])
    expect(result).toHaveLength(0)
  })

  it('mirror-side rule / opposite sides: down + up at a / mirror — no collision', () => {
    // DOWN is on face {right,down}, UP is on face {up,left} → opposite faces → no collision
    const streams: LaserStream[] = [
      { segments: [seg(5,1,5,2,'down'),  seg(5,2,5,3,'down'),  seg(5,3,5,4,'down'),  seg(5,4,5,5,'down')],  generation: 0 },
      { segments: [seg(5,9,5,8,'up'),    seg(5,8,5,7,'up'),    seg(5,7,5,6,'up'),    seg(5,6,5,5,'up')],    generation: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [mirror(5, 5, '/')])
    expect(result).toHaveLength(0)
  })

  it('mirror-side rule \\ same side: right + up at a \\ mirror — collision', () => {
    // RIGHT is on face {up,right}, UP is on face {up,right} → same face → collision
    const streams: LaserStream[] = [
      { segments: [seg(1,5,2,5,'right'), seg(2,5,3,5,'right'), seg(3,5,4,5,'right'), seg(4,5,5,5,'right')], generation: 0 },
      { segments: [seg(5,9,5,8,'up'),    seg(5,8,5,7,'up'),    seg(5,7,5,6,'up'),    seg(5,6,5,5,'up')],    generation: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [mirror(5, 5, '\\')])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 5, y: 5 })
  })

  it('mirror-side rule \\ opposite sides: up + down at a \\ mirror — no collision', () => {
    // UP is on face {up,right}, DOWN is on face {down,left} → opposite faces → no collision
    const streams: LaserStream[] = [
      { segments: [seg(5,9,5,8,'up'),   seg(5,8,5,7,'up'),   seg(5,7,5,6,'up'),   seg(5,6,5,5,'up')],   generation: 0 },
      { segments: [seg(5,1,5,2,'down'), seg(5,2,5,3,'down'), seg(5,3,5,4,'down'), seg(5,4,5,5,'down')], generation: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [mirror(5, 5, '\\')])
    expect(result).toHaveLength(0)
  })

  it('no mirror at cell: head-on beams always collide in open space', () => {
    // RIGHT and LEFT in open space (no mirror) → always collide
    const streams: LaserStream[] = [
      { segments: [seg(1,5,2,5,'right'), seg(2,5,3,5,'right'), seg(3,5,4,5,'right'), seg(4,5,5,5,'right')], generation: 0 },
      { segments: [seg(9,5,8,5,'left'),  seg(8,5,7,5,'left'),  seg(7,5,6,5,'left'),  seg(6,5,5,5,'left')],  generation: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 5, y: 5 })
    expect(streams[0].segments).toHaveLength(4)
    expect(streams[1].segments).toHaveLength(4)
  })

  it('perpendicular beams in open space do not collide', () => {
    // Stream 0 goes right, arriving at (5,5) at gTime=5 (segi=4).
    // Stream 1 goes down, arriving at (5,5) at gTime=5 (segi=4).
    // Perpendicular in open space → no collision.
    const streams: LaserStream[] = [
      { segments: [seg(0,5,1,5,'right'), seg(1,5,2,5,'right'), seg(2,5,3,5,'right'), seg(3,5,4,5,'right'), seg(4,5,5,5,'right')], generation: 0 },
      { segments: [seg(5,0,5,1,'down'),  seg(5,1,5,2,'down'),  seg(5,2,5,3,'down'),  seg(5,3,5,4,'down'),  seg(5,4,5,5,'down')],  generation: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [])
    expect(result).toHaveLength(0)
  })

  it('perpendicular beams in open space: all four combos pass through', () => {
    // up+right, up+left, down+right, down+left — none collide in open space
    const pairs: [Parameters<typeof seg>[4], Parameters<typeof seg>[4]][] = [
      ['up', 'right'], ['up', 'left'], ['down', 'right'], ['down', 'left'],
    ]
    for (const [d0, d1] of pairs) {
      const streams: LaserStream[] = [
        { segments: [seg(4,5,5,5,d0)], generation: 0 },
        { segments: [seg(4,5,5,5,d1)], generation: 1 },
      ]
      const result = resolveCollisions(streams, [0, 0], [])
      expect(result).toHaveLength(0)
    }
  })

  it('same-cell at different times does not trigger collision', () => {
    // Stream 0 arrives at (5,5) at gTime=5, Stream 1 arrives at gTime=8
    const streams: LaserStream[] = [
      { segments: [seg(1,5,2,5,'right'), seg(2,5,3,5,'right'), seg(3,5,4,5,'right'), seg(4,5,5,5,'right')], generation: 0 },
      { segments: [seg(8,5,7,5,'left'), seg(7,5,6,5,'left'), seg(6,5,5,5,'left')], generation: 1 },
    ]
    // offsets: stream 0 offset=0 → (5,5) at gTime 4; stream 1 offset=5 → (5,5) at gTime 5+2+1=8
    const result = resolveCollisions(streams, [0, 5], [])
    expect(result).toHaveLength(0)
  })

  it('loop: only ONE collision recorded for a symmetric head-on pair', () => {
    // Streams swap adjacent cells at T=5 (crossing) AND at T=6 (swap back).
    // The crossing check at T=5 and T=6 would both fire; pairKey deduplication
    // keeps only the earlier one (T=5).
    const streams: LaserStream[] = [
      {
        segments: [
          seg(0,5,1,5,'right'), seg(1,5,2,5,'right'), seg(2,5,3,5,'right'),
          seg(3,5,4,5,'right'), seg(4,5,5,5,'right'), seg(5,5,6,5,'right'),
          seg(6,5,7,5,'right'),
        ],
        generation: 0,
      },
      {
        segments: [
          seg(10,5,9,5,'left'), seg(9,5,8,5,'left'), seg(8,5,7,5,'left'),
          seg(7,5,6,5,'left'),  seg(6,5,5,5,'left'),  seg(5,5,4,5,'left'),
          seg(4,5,3,5,'left'),
        ],
        generation: 1,
      },
    ]
    const result = resolveCollisions(streams, [0, 0], [])
    expect(result).toHaveLength(1)
  })

  it('splitter: split-face vs wall-face arriving at same time — no collision', () => {
    // Splitter at (7,7) orientation='right': wall face = LEFT.
    // Stream 0 arrives going RIGHT (split face); stream 1 arrives going LEFT (wall face).
    // Wall-face beam simply stops — must not be treated as a collision with the other beam.
    const streams: LaserStream[] = [
      { segments: [seg(6, 7, 7, 7, 'right')], generation: 0, colorIndex: 0 },
      { segments: [seg(8, 7, 7, 7, 'left')],  generation: 1, colorIndex: 1 },
    ]
    const result = resolveCollisions(streams, [0, 0], [], [splitter(7, 7, 'right')])
    expect(result).toHaveLength(0)
  })

  it('splitter: two reflect-face beams arriving head-on should collide', () => {
    // Splitter at (7,7) orientation='right': reflect faces = UP and DOWN (both non-wall).
    // Opposite arrivals on non-wall faces must collide.
    const streams: LaserStream[] = [
      { segments: [seg(7, 8, 7, 7, 'up')],   generation: 1, colorIndex: 1 },
      { segments: [seg(7, 6, 7, 7, 'down')], generation: 1, colorIndex: 2 },
    ]
    const result = resolveCollisions(streams, [0, 0], [], [splitter(7, 7, 'right')])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 7, y: 7 })
  })
})

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
})

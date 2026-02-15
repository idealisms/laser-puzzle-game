import { calculateLaserPath, calculateScore } from './Laser'
import { Mirror, LaserConfig, Obstacle } from '../types'

// Small 5x5 grid for simple test cases
const bounds = { width: 5, height: 5 }

describe('calculateLaserPath', () => {
  it('travels straight and exits grid (edge termination)', () => {
    const laser: LaserConfig = { x: 0, y: 2, direction: 'right' }
    const path = calculateLaserPath(laser, [], [], bounds)

    expect(path.terminated).toBe(true)
    expect(path.terminationReason).toBe('edge')
    // Laser at x=0, moves right through x=1,2,3,4 then exits at x=5
    expect(path.totalLength).toBe(5)
  })

  it('stops at an obstacle', () => {
    const laser: LaserConfig = { x: 0, y: 2, direction: 'right' }
    const obstacles: Obstacle[] = [{ x: 3, y: 2 }]
    const path = calculateLaserPath(laser, [], obstacles, bounds)

    expect(path.terminated).toBe(true)
    expect(path.terminationReason).toBe('obstacle')
    // Laser at x=0, moves right: 1, 2, then hits obstacle at 3
    expect(path.totalLength).toBe(3)
  })

  it('reflects off a / mirror', () => {
    // Laser goes right, hits / mirror, reflects up, exits top edge
    const laser: LaserConfig = { x: 0, y: 3, direction: 'right' }
    const mirrors: Mirror[] = [{ position: { x: 2, y: 3 }, type: '/' }]
    const path = calculateLaserPath(laser, mirrors, [], bounds)

    expect(path.terminated).toBe(true)
    expect(path.terminationReason).toBe('edge')
    // right: 0→1, 1→2 (mirror), then up: 2→2(y=2), 2→2(y=1), 2→2(y=0), 2→2(y=-1 exit)
    expect(path.totalLength).toBe(2 + 4)
  })

  it('reflects off a \\ mirror', () => {
    // Laser goes right, hits \ mirror, reflects down, exits bottom edge
    const laser: LaserConfig = { x: 0, y: 1, direction: 'right' }
    const mirrors: Mirror[] = [{ position: { x: 2, y: 1 }, type: '\\' }]
    const path = calculateLaserPath(laser, mirrors, [], bounds)

    expect(path.terminated).toBe(true)
    expect(path.terminationReason).toBe('edge')
    // right: 0→1, 1→2 (mirror), then down: y=1→2, 2→3, 3→4, 4→5(exit)
    expect(path.totalLength).toBe(2 + 4)
  })

  it('handles multi-mirror zigzag path', () => {
    // Laser from left going right, two / mirrors create a zigzag
    const laser: LaserConfig = { x: -1, y: 4, direction: 'right' }
    const mirrors: Mirror[] = [
      { position: { x: 1, y: 4 }, type: '/' }, // right → up
      { position: { x: 1, y: 2 }, type: '\\' }, // up → left
    ]
    const largeBounds = { width: 5, height: 5 }
    const path = calculateLaserPath(laser, mirrors, [], largeBounds)

    expect(path.terminated).toBe(true)
    expect(path.terminationReason).toBe('edge')
    // right: -1→0, 0→1 (mirror /), up: 1→y3, 1→y2 (mirror \), left: 1→0, 0→-1(exit)
    expect(path.totalLength).toBe(2 + 2 + 2)
  })
})

describe('calculateScore', () => {
  it('returns totalLength of the laser path', () => {
    const laser: LaserConfig = { x: 0, y: 0, direction: 'right' }
    const path = calculateLaserPath(laser, [], [], bounds)

    expect(calculateScore(path)).toBe(path.totalLength)
  })
})

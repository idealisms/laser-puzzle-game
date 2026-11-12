import { calculateLaserPath } from '@/game/engine/simulate'
import { EXAMPLES, Example } from './examples'

function trace(e: Example) {
  const { level } = e
  return calculateLaserPath(level.laserConfig, e.mirrors, level.obstacles, {
    width: level.gridWidth,
    height: level.gridHeight,
  })
}

// The guide's captions describe these outcomes; keep them true if the engine changes.
describe('how-to-play examples', () => {
  it('mirrors: one beam, turned twice, leaves the board', () => {
    const p = trace(EXAMPLES.mirrors)
    expect(p.streams).toHaveLength(1)
    expect(p.terminationReason).toBe('edge')
    expect(new Set(p.streams[0].segments.map((s) => s.direction))).toEqual(new Set(['right', 'down', 'left']))
  })

  it('walls: the path goes around the wall without touching it', () => {
    const p = trace(EXAMPLES.walls)
    expect(p.terminationReason).toBe('edge')
    const cells = p.streams[0].segments.map((s) => `${s.end.x},${s.end.y}`)
    expect(cells).not.toContain('4,1')
    expect(cells).not.toContain('4,2')
  })

  it('splitter: into the point makes two more beams', () => {
    const p = trace(EXAMPLES.splitterSplit)
    expect(p.streams).toHaveLength(3)
    expect(p.collisionPoints).toEqual([])
  })

  it('splitter: into a side turns the beam toward the point', () => {
    const p = trace(EXAMPLES.splitterTurn)
    expect(p.streams).toHaveLength(1)
    const last = p.streams[0].segments.at(-1)!
    expect(last.direction).toBe('left')
  })

  it('gate: passes with the arrow, blocks against it', () => {
    expect(trace(EXAMPLES.gatePass).terminationReason).toBe('edge')
    expect(trace(EXAMPLES.gateBlock).terminationReason).toBe('obstacle')
  })

  it('portals: the beam reaches the far side of the sealed wall', () => {
    const p = trace(EXAMPLES.portals)
    expect(p.terminationReason).toBe('edge')
    const last = p.streams[0].segments.at(-1)!
    expect(last.end).toEqual({ x: 7, y: 3 })
  })

  it('collision: the split beams meet head-on', () => {
    const p = trace(EXAMPLES.collision)
    expect(p.streams).toHaveLength(3)
    expect(p.collisionPoints).toHaveLength(1)
  })
})

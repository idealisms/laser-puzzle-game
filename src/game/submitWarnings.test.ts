import { calculateLaserPath } from './engine/simulate'
import { findUnusedMirrors, getSubmitWarnings } from './submitWarnings'
import type { Mirror, Obstacle } from './types'

const m = (x: number, y: number, type: '/' | '\\'): Mirror => ({ position: { x, y }, type })

// Laser at (0,0) heading right on a 7×5 board.
function path(mirrors: Mirror[], obstacles: Obstacle[] = []) {
  return calculateLaserPath({ x: 0, y: 0, direction: 'right' }, mirrors, obstacles, { width: 7, height: 5 })
}

function warn(placed: Mirror[], opts: { available?: number; best?: number; obstacles?: Obstacle[] } = {}) {
  const laserPath = path(placed, opts.obstacles)
  return getSubmitWarnings({
    placedMirrors: placed,
    mirrorsAvailable: opts.available ?? placed.length,
    laserPath,
    score: laserPath.totalLength,
    sessionBestScore: opts.best ?? 0,
  })
}

describe('findUnusedMirrors', () => {
  it('finds mirrors the beam never reaches', () => {
    const used = m(4, 0, '\\') // turns the beam down
    const unused = m(2, 3, '/')
    expect(findUnusedMirrors([used, unused], path([used, unused]))).toEqual([unused])
  })

  it('counts mirrors reached by split beams', () => {
    const splitter: Obstacle = { x: 3, y: 0, type: 'splitter', orientation: 'right' }
    const onSplitBeam = m(3, 4, '/') // the down beam from the splitter
    expect(findUnusedMirrors([onSplitBeam], path([onSplitBeam], [splitter]))).toEqual([])
  })

  it('handles no laser path', () => {
    expect(findUnusedMirrors([m(1, 1, '/')], null)).toHaveLength(1)
  })
})

describe('getSubmitWarnings', () => {
  it('has nothing to say about a full, used, best path', () => {
    expect(warn([m(4, 0, '\\'), m(4, 3, '/')], { best: 5 })).toEqual([])
  })

  it('warns about mirrors left to place', () => {
    expect(warn([m(4, 0, '\\')], { available: 3 })).toEqual([
      { id: 'unplaced-mirrors', message: 'You still have 2 mirrors left to place.' },
    ])
    expect(warn([m(4, 0, '\\')], { available: 2 })[0].message).toBe('You still have 1 mirror left to place.')
  })

  it('warns about mirrors the laser misses', () => {
    expect(warn([m(4, 0, '\\'), m(1, 3, '/')]).map((w) => w.id)).toEqual(['unused-mirrors'])
    expect(warn([m(4, 0, '\\'), m(1, 3, '/')])[0].message).toMatch(/^1 of your mirrors isn’t touched/)
    expect(warn([m(1, 3, '/'), m(2, 3, '/')])[0].message).toMatch(/^2 of your mirrors aren’t touched/)
  })

  it('warns when the current path is shorter than the best one this session', () => {
    const [w] = warn([m(4, 0, '\\')], { best: 20 })
    expect(w).toEqual({
      id: 'not-best',
      message: 'This path is 9 long, but you reached 20 earlier. Tap Best to bring that path back.',
    })
  })

  it('lists every problem, in order', () => {
    expect(warn([m(1, 3, '/')], { available: 4, best: 50 }).map((w) => w.id)).toEqual([
      'unplaced-mirrors',
      'unused-mirrors',
      'not-best',
    ])
  })
})

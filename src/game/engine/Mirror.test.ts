import { reflectLaser, getOppositeDirection, getDirectionDelta } from './Mirror'
import { Direction, MirrorType } from '../types'

describe('reflectLaser', () => {
  describe('backslash mirror (\\)', () => {
    const mirror: MirrorType = '\\'

    it('reflects right → down', () => {
      expect(reflectLaser('right', mirror)).toBe('down')
    })

    it('reflects up → left', () => {
      expect(reflectLaser('up', mirror)).toBe('left')
    })

    it('reflects left → up', () => {
      expect(reflectLaser('left', mirror)).toBe('up')
    })

    it('reflects down → right', () => {
      expect(reflectLaser('down', mirror)).toBe('right')
    })
  })

  describe('forward slash mirror (/)', () => {
    const mirror: MirrorType = '/'

    it('reflects right → up', () => {
      expect(reflectLaser('right', mirror)).toBe('up')
    })

    it('reflects down → left', () => {
      expect(reflectLaser('down', mirror)).toBe('left')
    })

    it('reflects left → down', () => {
      expect(reflectLaser('left', mirror)).toBe('down')
    })

    it('reflects up → right', () => {
      expect(reflectLaser('up', mirror)).toBe('right')
    })
  })
})

describe('getOppositeDirection', () => {
  it.each<[Direction, Direction]>([
    ['up', 'down'],
    ['down', 'up'],
    ['left', 'right'],
    ['right', 'left'],
  ])('returns %s → %s', (input, expected) => {
    expect(getOppositeDirection(input)).toBe(expected)
  })
})

describe('getDirectionDelta', () => {
  it.each<[Direction, number, number]>([
    ['up', 0, -1],
    ['down', 0, 1],
    ['left', -1, 0],
    ['right', 1, 0],
  ])('returns correct delta for %s', (direction, dx, dy) => {
    expect(getDirectionDelta(direction)).toEqual({ dx, dy })
  })
})

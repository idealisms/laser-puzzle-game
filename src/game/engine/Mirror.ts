import { Direction, MirrorType } from '../types'

/**
 * Mirror reflection logic:
 *
 * '\' (nw-se diagonal):
 *   right → down
 *   up → left
 *   left → up
 *   down → right
 *
 * '/' (ne-sw diagonal):
 *   right → up
 *   down → left
 *   left → down
 *   up → right
 */

const REFLECTIONS: Record<MirrorType, Record<Direction, Direction>> = {
  '\\': {
    right: 'down',
    up: 'left',
    left: 'up',
    down: 'right',
  },
  '/': {
    right: 'up',
    down: 'left',
    left: 'down',
    up: 'right',
  },
}

export function reflectLaser(incomingDirection: Direction, mirrorType: MirrorType): Direction {
  return REFLECTIONS[mirrorType][incomingDirection]
}

export function getOppositeDirection(direction: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  }
  return opposites[direction]
}

export function getDirectionDelta(direction: Direction): { dx: number; dy: number } {
  const deltas: Record<Direction, { dx: number; dy: number }> = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
  }
  return deltas[direction]
}

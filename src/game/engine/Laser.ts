import {
  Position,
  Direction,
  Mirror,
  Obstacle,
  LaserConfig,
  LaserPath,
  LaserSegment,
  LaserStream,
} from '../types'
import { MAX_LASER_LENGTH } from '../constants'
import { reflectLaser, getDirectionDelta } from './Mirror'

interface GridBounds {
  width: number
  height: number
}

function positionKey(pos: Position, dir: Direction): string {
  return `${pos.x},${pos.y},${dir}`
}

function isInBounds(pos: Position, bounds: GridBounds): boolean {
  return pos.x >= 0 && pos.x < bounds.width && pos.y >= 0 && pos.y < bounds.height
}

function findObstacle(pos: Position, obstacles: Obstacle[]): Obstacle | undefined {
  return obstacles.find((o) => o.x === pos.x && o.y === pos.y)
}

function oppositeDir(dir: Direction): Direction {
  switch (dir) {
    case 'right': return 'left'
    case 'left':  return 'right'
    case 'up':    return 'down'
    case 'down':  return 'up'
  }
}

type ObstacleAction =
  | { kind: 'wall' }
  | { kind: 'split'; dirs: [Direction, Direction] }
  | { kind: 'reflect'; dir: Direction }

function getObstacleAction(laserDir: Direction, obstacle: Obstacle): ObstacleAction {
  if (obstacle.type !== 'splitter') {
    return { kind: 'wall' }
  }
  const orientation: Direction = obstacle.orientation ?? 'right'
  if (laserDir === orientation) {
    // Laser hits the open/splitting face — split perpendicularly
    const dirs: [Direction, Direction] =
      laserDir === 'left' || laserDir === 'right' ? ['up', 'down'] : ['left', 'right']
    return { kind: 'split', dirs }
  }
  if (laserDir === oppositeDir(orientation)) {
    // Laser hits the hypotenuse (wall face) — blocked
    return { kind: 'wall' }
  }
  // Laser is perpendicular — reflect back toward opposite of orientation
  return { kind: 'reflect', dir: oppositeDir(orientation) }
}

function findMirror(pos: Position, mirrors: Mirror[]): Mirror | undefined {
  return mirrors.find((m) => m.position.x === pos.x && m.position.y === pos.y)
}

interface StackItem {
  startPos: Position
  startDir: Direction
  generation: number
}

export function calculateLaserPath(
  laserConfig: LaserConfig,
  mirrors: Mirror[],
  obstacles: Obstacle[],
  bounds: GridBounds
): LaserPath {
  const streams: LaserStream[] = []
  const visited = new Set<string>()
  let totalLength = 0
  let terminationReason: LaserPath['terminationReason'] = 'max-length'

  const stack: StackItem[] = [
    { startPos: { x: laserConfig.x, y: laserConfig.y }, startDir: laserConfig.direction, generation: 0 },
  ]

  while (stack.length > 0) {
    const { startPos, startDir, generation } = stack.pop()!
    const streamSegments: LaserSegment[] = []
    let pos: Position = { ...startPos }
    let dir: Direction = startDir

    while (totalLength < MAX_LASER_LENGTH) {
      const stateKey = positionKey(pos, dir)

      if (visited.has(stateKey)) {
        terminationReason = 'loop'
        break
      }
      visited.add(stateKey)

      const moveDelta = getDirectionDelta(dir)
      const nextPos: Position = {
        x: pos.x + moveDelta.dx,
        y: pos.y + moveDelta.dy,
      }

      if (!isInBounds(nextPos, bounds)) {
        streamSegments.push({ start: { ...pos }, end: { ...nextPos }, direction: dir })
        totalLength++
        terminationReason = 'edge'
        break
      }

      const obstacle = findObstacle(nextPos, obstacles)
      if (obstacle) {
        const action = getObstacleAction(dir, obstacle)
        streamSegments.push({ start: { ...pos }, end: { ...nextPos }, direction: dir })
        totalLength++
        if (action.kind === 'wall') {
          terminationReason = 'obstacle'
          break
        }
        if (action.kind === 'split') {
          stack.push({ startPos: { ...nextPos }, startDir: action.dirs[0], generation: generation + 1 })
          stack.push({ startPos: { ...nextPos }, startDir: action.dirs[1], generation: generation + 1 })
          break
        }
        // reflect: continue from splitter cell in new direction
        dir = action.dir
        pos = nextPos
        continue
      }

      const mirror = findMirror(nextPos, mirrors)
      if (mirror) {
        streamSegments.push({ start: { ...pos }, end: { ...nextPos }, direction: dir })
        totalLength++
        dir = reflectLaser(dir, mirror.type)
        pos = nextPos
      } else {
        streamSegments.push({ start: { ...pos }, end: { ...nextPos }, direction: dir })
        totalLength++
        pos = nextPos
      }
    }

    streams.push({ segments: streamSegments, generation })
  }

  return {
    streams,
    totalLength,
    terminated: true,
    terminationReason,
  }
}

export function calculateScore(laserPath: LaserPath): number {
  return laserPath.totalLength
}

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

function isWall(pos: Position, obstacles: Obstacle[]): boolean {
  return obstacles.some((o) => o.x === pos.x && o.y === pos.y && o.type !== 'splitter')
}

function isSplitter(pos: Position, obstacles: Obstacle[]): boolean {
  return obstacles.some((o) => o.x === pos.x && o.y === pos.y && o.type === 'splitter')
}

function getSplitDirections(dir: Direction): [Direction, Direction] {
  if (dir === 'left' || dir === 'right') {
    return ['up', 'down']
  }
  return ['left', 'right']
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

      if (isWall(nextPos, obstacles)) {
        streamSegments.push({ start: { ...pos }, end: { ...nextPos }, direction: dir })
        totalLength++
        terminationReason = 'obstacle'
        break
      }

      if (isSplitter(nextPos, obstacles)) {
        streamSegments.push({ start: { ...pos }, end: { ...nextPos }, direction: dir })
        totalLength++
        const [dir1, dir2] = getSplitDirections(dir)
        stack.push({ startPos: { ...nextPos }, startDir: dir1, generation: generation + 1 })
        stack.push({ startPos: { ...nextPos }, startDir: dir2, generation: generation + 1 })
        break
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

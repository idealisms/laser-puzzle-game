import {
  Position,
  Direction,
  Mirror,
  Obstacle,
  LaserConfig,
  LaserPath,
  LaserSegment,
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

function isObstacle(pos: Position, obstacles: Obstacle[]): boolean {
  return obstacles.some((o) => o.x === pos.x && o.y === pos.y)
}

function findMirror(pos: Position, mirrors: Mirror[]): Mirror | undefined {
  return mirrors.find((m) => m.position.x === pos.x && m.position.y === pos.y)
}

export function calculateLaserPath(
  laserConfig: LaserConfig,
  mirrors: Mirror[],
  obstacles: Obstacle[],
  bounds: GridBounds
): LaserPath {
  const segments: LaserSegment[] = []
  const visited = new Set<string>()

  let currentPos: Position = { x: laserConfig.x, y: laserConfig.y }
  let currentDir: Direction = laserConfig.direction
  let totalLength = 0
  let terminated = false
  let terminationReason: LaserPath['terminationReason'] = 'max-length'

  // Move to the first cell in the laser's direction
  const delta = getDirectionDelta(currentDir)
  let nextPos: Position = {
    x: currentPos.x + delta.dx,
    y: currentPos.y + delta.dy,
  }

  while (totalLength < MAX_LASER_LENGTH) {
    const stateKey = positionKey(currentPos, currentDir)

    // Check for loop
    if (visited.has(stateKey)) {
      terminated = true
      terminationReason = 'loop'
      break
    }
    visited.add(stateKey)

    // Find next position
    const moveDelta = getDirectionDelta(currentDir)
    nextPos = {
      x: currentPos.x + moveDelta.dx,
      y: currentPos.y + moveDelta.dy,
    }

    // Check if next position is out of bounds
    if (!isInBounds(nextPos, bounds)) {
      // Create segment to the edge
      segments.push({
        start: { ...currentPos },
        end: { ...nextPos },
        direction: currentDir,
      })
      totalLength += 1
      terminated = true
      terminationReason = 'edge'
      break
    }

    // Check if next position is an obstacle
    if (isObstacle(nextPos, obstacles)) {
      // Laser stops at obstacle
      segments.push({
        start: { ...currentPos },
        end: { ...nextPos },
        direction: currentDir,
      })
      totalLength += 1
      terminated = true
      terminationReason = 'obstacle'
      break
    }

    // Check for mirror at next position
    const mirror = findMirror(nextPos, mirrors)

    if (mirror) {
      // Create segment to mirror
      segments.push({
        start: { ...currentPos },
        end: { ...nextPos },
        direction: currentDir,
      })
      totalLength += 1

      // Reflect laser
      currentDir = reflectLaser(currentDir, mirror.type)
      currentPos = nextPos
    } else {
      // Continue in same direction
      segments.push({
        start: { ...currentPos },
        end: { ...nextPos },
        direction: currentDir,
      })
      totalLength += 1
      currentPos = nextPos
    }
  }

  return {
    segments,
    totalLength,
    terminated,
    terminationReason,
  }
}

export function calculateScore(laserPath: LaserPath): number {
  return laserPath.totalLength
}

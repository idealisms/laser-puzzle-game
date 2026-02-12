import { calculateLaserPath, calculateScore } from '@/game/engine/Laser'
import { LaserConfig, Obstacle, Mirror, MirrorType } from '@/game/types'

interface LevelData {
  gridWidth: number
  gridHeight: number
  laserConfig: string
  obstacles: string
  mirrorsAvailable: number
}

interface MirrorInput {
  x: number
  y: number
  type: string
}

const VALID_MIRROR_TYPES: MirrorType[] = ['/', '\\']

export function validateMirrors(
  mirrorInputs: MirrorInput[],
  level: LevelData
): { valid: true; mirrors: Mirror[] } | { valid: false; error: string } {
  const laserConfig: LaserConfig = JSON.parse(level.laserConfig)
  const obstacles: Obstacle[] = JSON.parse(level.obstacles)

  if (mirrorInputs.length > level.mirrorsAvailable) {
    return { valid: false, error: `Too many mirrors: ${mirrorInputs.length} > ${level.mirrorsAvailable}` }
  }

  const mirrors: Mirror[] = []
  const seen = new Set<string>()

  for (const m of mirrorInputs) {
    if (typeof m.x !== 'number' || typeof m.y !== 'number' ||
        !VALID_MIRROR_TYPES.includes(m.type as MirrorType)) {
      return { valid: false, error: `Invalid mirror data` }
    }

    if (!Number.isInteger(m.x) || !Number.isInteger(m.y)) {
      return { valid: false, error: `Mirror coordinates must be integers` }
    }

    if (m.x < 0 || m.x >= level.gridWidth || m.y < 0 || m.y >= level.gridHeight) {
      return { valid: false, error: `Mirror out of bounds: (${m.x}, ${m.y})` }
    }

    if (m.x === laserConfig.x && m.y === laserConfig.y) {
      return { valid: false, error: `Mirror cannot be on laser source` }
    }

    if (obstacles.some(o => o.x === m.x && o.y === m.y)) {
      return { valid: false, error: `Mirror cannot be on obstacle at (${m.x}, ${m.y})` }
    }

    const key = `${m.x},${m.y}`
    if (seen.has(key)) {
      return { valid: false, error: `Duplicate mirror position: (${m.x}, ${m.y})` }
    }
    seen.add(key)

    mirrors.push({ position: { x: m.x, y: m.y }, type: m.type as MirrorType })
  }

  return { valid: true, mirrors }
}

export function computeScore(mirrors: Mirror[], level: LevelData): number {
  const laserConfig: LaserConfig = JSON.parse(level.laserConfig)
  const obstacles: Obstacle[] = JSON.parse(level.obstacles)

  const path = calculateLaserPath(
    laserConfig,
    mirrors,
    obstacles,
    { width: level.gridWidth, height: level.gridHeight }
  )

  return calculateScore(path)
}

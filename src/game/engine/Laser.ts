export { resolveCollisions, calculateLaserPath } from './simulate'
import { LaserPath } from '../types'

export function calculateScore(laserPath: LaserPath): number {
  return laserPath.totalLength
}

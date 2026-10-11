import {
  Position,
  Direction,
  Mirror,
  Obstacle,
  LaserConfig,
  LaserPath,
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
  | { kind: 'pass' }
  | { kind: 'split'; dirs: [Direction, Direction] }
  | { kind: 'reflect'; dir: Direction }

function getObstacleAction(laserDir: Direction, obstacle: Obstacle): ObstacleAction {
  if (obstacle.type === 'gate') {
    const passDir: Direction = obstacle.orientation ?? 'right'
    return laserDir === passDir ? { kind: 'pass' } : { kind: 'wall' }
  }
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

/**
 * Returns which face of a mirror the laser is hitting (0 or 1).
 *
 * For '/': face 0 = {up, left}, face 1 = {right, down}
 * For '\': face 0 = {up, right}, face 1 = {down, left}
 *
 * Two beams on the same face collide; on opposite faces they pass through independently.
 */
function mirrorSide(dir: Direction, mirrorType: '/' | '\\'): 0 | 1 {
  if (mirrorType === '/') {
    return (dir === 'up' || dir === 'left') ? 0 : 1
  } else {
    return (dir === 'up' || dir === 'right') ? 0 : 1
  }
}

/**
 * Do two beams that arrive at the same cell at the same time collide?
 * `dirA` and `dirB` are the directions the beams were travelling as they arrived.
 *
 *   - Mirror cell: only beams hitting the same mirror face collide (mirrorSide).
 *   - Splitter cell: they collide unless at least one hits the wall face, which
 *     just stops that beam.
 *   - Anything else (open cell, wall, gate, off-grid): head-on or same-direction
 *     beams collide; perpendicular beams pass through each other.
 *
 * Exported for unit testing.
 */
export function sameCellCollision(
  cell: Position,
  dirA: Direction,
  dirB: Direction,
  mirrors: Mirror[],
  obstacles: Obstacle[] = []
): boolean {
  const m = findMirror(cell, mirrors)
  if (m) return mirrorSide(dirA, m.type) === mirrorSide(dirB, m.type)
  const spl = obstacles.find((o) => o.type === 'splitter' && o.x === cell.x && o.y === cell.y)
  if (spl) {
    const wallDir = oppositeDir(spl.orientation ?? 'right')
    return dirA !== wallDir && dirB !== wallDir
  }
  return dirA === dirB || dirA === oppositeDir(dirB)
}

function findMirror(pos: Position, mirrors: Mirror[]): Mirror | undefined {
  return mirrors.find((m) => m.position.x === pos.x && m.position.y === pos.y)
}

interface Beam {
  pos: Position
  dir: Direction
  stream: LaserStream
}

type StepOutcome =
  | { kind: 'continue'; dir: Direction }
  | { kind: 'stop'; reason: LaserPath['terminationReason'] }
  | { kind: 'split'; dirs: [Direction, Direction] }

interface Arrival {
  beam: Beam
  to: Position
  dir: Direction // direction of travel into `to`
  outcome: StepOutcome
  collided: boolean
}

/**
 * Trace the laser, advancing every beam one cell per time step.
 *
 * Beams move in lockstep so that collisions are resolved in time order: two
 * beams that arrive at the same cell at the same time and collide (see
 * sameCellCollision) both stop there, and a stopped beam never reaches any
 * later mirror or splitter, so it spawns nothing further.
 *
 * Beams can never cross mid-step (swap two adjacent cells): every beam starts
 * at the laser and moves one cell per step, so at time t every beam is on a
 * cell with (x + y) ≡ (laser.x + laser.y + t) mod 2, and no two beams are ever
 * on adjacent cells at the same time.
 *
 * Loop detection is shared by all beams: a beam stops when it is about to
 * leave a cell in a direction that any beam already left that cell in.
 *
 * totalLength counts every step of every beam (beams sharing a cell count
 * independently), capped at MAX_LASER_LENGTH steps overall.
 */
export function calculateLaserPath(
  laserConfig: LaserConfig,
  mirrors: Mirror[],
  obstacles: Obstacle[],
  bounds: GridBounds
): LaserPath {
  const streams: LaserStream[] = []
  const visited = new Set<string>()
  const collisionPoints: Position[] = []
  let totalLength = 0
  let terminationReason: LaserPath['terminationReason'] = 'max-length'
  let nextColorIndex = 1

  const newBeam = (pos: Position, dir: Direction, generation: number, globalOffset: number, colorIndex: number): Beam => {
    const stream: LaserStream = { segments: [], generation, colorIndex, globalOffset }
    streams.push(stream)
    return { pos: { ...pos }, dir, stream }
  }

  let beams: Beam[] = [newBeam({ x: laserConfig.x, y: laserConfig.y }, laserConfig.direction, 0, 0, 0)]

  for (let time = 1; beams.length > 0; time++) {
    // 1. Move every beam one cell.
    const arrivals: Arrival[] = []
    for (const beam of beams) {
      if (totalLength >= MAX_LASER_LENGTH) {
        terminationReason = 'max-length'
        continue
      }
      const stateKey = positionKey(beam.pos, beam.dir)
      if (visited.has(stateKey)) {
        terminationReason = 'loop'
        continue
      }
      visited.add(stateKey)

      const { dx, dy } = getDirectionDelta(beam.dir)
      const to: Position = { x: beam.pos.x + dx, y: beam.pos.y + dy }
      beam.stream.segments.push({ start: { ...beam.pos }, end: { ...to }, direction: beam.dir })
      totalLength++

      let outcome: StepOutcome
      if (!isInBounds(to, bounds)) {
        outcome = { kind: 'stop', reason: 'edge' }
      } else {
        const obstacle = findObstacle(to, obstacles)
        if (obstacle) {
          const action = getObstacleAction(beam.dir, obstacle)
          if (action.kind === 'wall') outcome = { kind: 'stop', reason: 'obstacle' }
          else if (action.kind === 'pass') outcome = { kind: 'continue', dir: beam.dir }
          else if (action.kind === 'split') outcome = { kind: 'split', dirs: action.dirs }
          else outcome = { kind: 'continue', dir: action.dir }
        } else {
          const mirror = findMirror(to, mirrors)
          outcome = { kind: 'continue', dir: mirror ? reflectLaser(beam.dir, mirror.type) : beam.dir }
        }
      }
      arrivals.push({ beam, to, dir: beam.dir, outcome, collided: false })
    }

    // 2. Resolve collisions between beams that moved this step.
    for (let i = 0; i < arrivals.length; i++) {
      for (let j = i + 1; j < arrivals.length; j++) {
        const a = arrivals[i], b = arrivals[j]
        if (a.to.x === b.to.x && a.to.y === b.to.y && sameCellCollision(a.to, a.dir, b.dir, mirrors, obstacles)) {
          a.collided = b.collided = true
          collisionPoints.push({ ...a.to })
        }
      }
    }

    // 3. Apply each surviving beam's outcome.
    const next: Beam[] = []
    for (const arr of arrivals) {
      const { beam, outcome } = arr
      if (arr.collided) {
        terminationReason = 'obstacle'
        continue
      }
      if (outcome.kind === 'stop') {
        terminationReason = outcome.reason
      } else if (outcome.kind === 'split') {
        // One child keeps the parent's color; the other gets a fresh one.
        const gen = beam.stream.generation + 1
        next.push(newBeam(arr.to, outcome.dirs[1], gen, time, beam.stream.colorIndex ?? 0))
        next.push(newBeam(arr.to, outcome.dirs[0], gen, time, nextColorIndex++))
      } else {
        beam.pos = arr.to
        beam.dir = outcome.dir
        next.push(beam)
      }
    }
    beams = next
  }

  return {
    streams: streams.filter((st) => st.segments.length > 0),
    totalLength,
    terminated: true,
    terminationReason,
    collisionPoints,
  }
}

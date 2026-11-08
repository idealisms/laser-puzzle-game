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
  const obs = findObstacle(cell, obstacles)
  if (obs?.type === 'splitter') {
    const wallDir = oppositeDir(obs.orientation ?? 'right')
    return dirA !== wallDir && dirB !== wallDir
  }
  return dirA === dirB || dirA === oppositeDir(dirB)
}

/**
 * Does a beam entering `cell` travelling `dir` collide with an earlier beam
 * that entered the same cell travelling `litDir` and still lights it?
 *
 * Same rule as sameCellCollision, except that a beam entering in the same
 * direction as the lit beam just merges into it (loop detection stops it).
 *
 * Exported for unit testing.
 */
export function litCellCollision(
  cell: Position,
  litDir: Direction,
  dir: Direction,
  mirrors: Mirror[],
  obstacles: Obstacle[] = []
): boolean {
  return litDir !== dir && sameCellCollision(cell, litDir, dir, mirrors, obstacles)
}

function findMirror(pos: Position, mirrors: Mirror[]): Mirror | undefined {
  return mirrors.find((m) => m.position.x === pos.x && m.position.y === pos.y)
}

interface Beam {
  id: number
  pos: Position
  dir: Direction
  stream: LaserStream
}

type StepOutcome =
  | { kind: 'continue'; dir: Direction }
  | { kind: 'teleport'; to: Position }
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
 * A beam is a continuous stream, so every cell it has entered stays lit after
 * its front moves on. A beam that later enters a lit cell and would collide
 * with the beam lighting it (see litCellCollision) stops at the edge of that
 * cell; the earlier beam is unaffected. Cells a beam is blocked by (walls, a
 * gate's closed side, a splitter's wall face, off-grid) and portals are not
 * lit.
 *
 * A beam that enters a portal leaves from its twin in the same direction on
 * the next step; the jump itself takes no time. A portal is a hole: beams
 * going into it never collide there, from any side and at any time, and it is
 * never lit. Two beams going head-on through a pair would meet just outside
 * it, each coming out onto the path the other went in on; they pass each
 * other through the portal instead: two beams going into the two portals of
 * a pair in opposite directions, at the same step or one step apart, become
 * partners, and partners never collide with each other (each retraces the
 * other's path, meeting it head-on or on the same mirror face).
 *
 * Without portals, beams can never cross mid-step (swap two adjacent cells),
 * since every beam is on a cell of the same parity at any time. A portal can
 * join cells of different parity; a beam coming out of a portal into a cell
 * another beam lit is stopped by the lit-cell rule as usual.
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
  // cell key → directions of the beams that have entered (and lit) the cell
  const lit = new Map<string, { dir: Direction; id: number }[]>()
  const collisionPoints: Position[] = []
  let totalLength = 0
  let terminationReason: LaserPath['terminationReason'] = 'max-length'
  let nextColorIndex = 1

  // Portals: each portal cell's twin.
  const twins = new Map<string, Position>()
  for (const o of obstacles) {
    if (o.type !== 'portal') continue
    const twin = obstacles.find((t) => t.type === 'portal' && t.pair === o.pair && t !== o)
    if (twin) twins.set(`${o.x},${o.y}`, { x: twin.x, y: twin.y })
  }
  const cellKey = (pos: Position) => `${pos.x},${pos.y}`
  const addCollision = (pos: Position) => {
    if (!collisionPoints.some((p) => p.x === pos.x && p.y === pos.y)) collisionPoints.push(pos)
  }

  let nextBeamId = 0
  const newBeam = (pos: Position, dir: Direction, generation: number, globalOffset: number, colorIndex: number): Beam => {
    const stream: LaserStream = { segments: [], generation, colorIndex, globalOffset }
    streams.push(stream)
    return { id: nextBeamId++, pos: { ...pos }, dir, stream }
  }

  // Portal crossings: "x,y,dir" of a portal → the beam that went into it
  // heading dir, and when (at most one, by loop detection). Pairs of beams
  // that passed each other through a portal pair, as "a,b" with a < b.
  const portalEntries = new Map<string, { id: number; time: number }>()
  const partners = new Set<string>()
  const partnerKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)
  const passes = (arr: Arrival, earlier: { dir: Direction; id: number }) =>
    partners.has(partnerKey(arr.beam.id, earlier.id))

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
        if (obstacle?.type === 'portal' && twins.has(`${to.x},${to.y}`)) {
          outcome = { kind: 'teleport', to: twins.get(`${to.x},${to.y}`)! }
        } else if (obstacle) {
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

    // Beams going into a portal this step. One going into the twin portal in
    // the opposite direction at this step or the one before passes this one:
    // they become partners.
    for (const arr of arrivals) {
      if (arr.outcome.kind === 'teleport') portalEntries.set(`${arr.to.x},${arr.to.y},${arr.dir}`, { id: arr.beam.id, time })
    }
    for (const arr of arrivals) {
      if (arr.outcome.kind !== 'teleport') continue
      const twin = arr.outcome.to
      const other = portalEntries.get(`${twin.x},${twin.y},${oppositeDir(arr.dir)}`)
      if (other && other.id !== arr.beam.id && other.time >= time - 1) partners.add(partnerKey(arr.beam.id, other.id))
    }

    // 2. Resolve collisions between beams that moved this step.
    for (let i = 0; i < arrivals.length; i++) {
      for (let j = i + 1; j < arrivals.length; j++) {
        const a = arrivals[i], b = arrivals[j]
        if (a.outcome.kind === 'teleport') continue // beams going into a portal never collide there
        if (cellKey(a.to) === cellKey(b.to) && sameCellCollision(a.to, a.dir, b.dir, mirrors, obstacles) &&
            !partners.has(partnerKey(a.beam.id, b.beam.id))) {
          a.collided = b.collided = true
          addCollision({ ...a.to })
          addCollision({ ...b.to })
        }
      }
    }

    // 3. Beams entering a cell lit by an earlier beam collide with it on the
    //    cell's edge. Several beams stopped entering the same cell at once
    //    show one collision, at the cell's centre.
    const litStops = new Map<string, Arrival[]>()
    for (const arr of arrivals) {
      if (arr.collided || arr.outcome.kind === 'teleport') continue
      const earlier = lit.get(cellKey(arr.to)) ?? []
      if (earlier.some((e) => litCellCollision(arr.to, e.dir, arr.dir, mirrors, obstacles) && !passes(arr, e))) {
        arr.collided = true
        const key = cellKey(arr.to)
        const stops = litStops.get(key)
        if (stops) stops.push(arr)
        else litStops.set(key, [arr])
      }
    }
    for (const stops of litStops.values()) {
      if (stops.length > 1) addCollision({ ...stops[0].to })
      else addCollision({ x: (stops[0].beam.pos.x + stops[0].to.x) / 2, y: (stops[0].beam.pos.y + stops[0].to.y) / 2 })
    }

    // 4. Every beam that got into its cell lights it, including beams that
    //    collided there.
    for (const arr of arrivals) {
      if (arr.outcome.kind === 'stop' || arr.outcome.kind === 'teleport') continue
      const key = cellKey(arr.to)
      const entries = lit.get(key)
      if (entries) entries.push({ dir: arr.dir, id: arr.beam.id })
      else lit.set(key, [{ dir: arr.dir, id: arr.beam.id }])
    }

    // 5. Apply each surviving beam's outcome.
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
      } else if (outcome.kind === 'teleport') {
        beam.pos = { ...outcome.to }
        next.push(beam)
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

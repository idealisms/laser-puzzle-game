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

function cellKey(pos: Position): string {
  return `${pos.x},${pos.y}`
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

type ArrivalInfo = { si: number; segi: number; dir: Direction; pos: Position }

/**
 * Post-process computed streams to find head-on collisions: two beams from different
 * streams that physically meet at the same point at the same time.
 *
 * Each stream has a globalOffset = total steps from the laser source to where it started.
 * The global time when a beam reaches the END of segment[segi] is: offset + segi + 1.
 *
 * Two collision types:
 *   1. Same-cell same-time: both beams arrive at the same non-mirror cell from opposite
 *      directions at the same global time.
 *   2. Crossing: at the same global time, beam A is at cell P heading toward Q and beam B
 *      is at Q heading toward P — they cross between the cells. The collision position is
 *      the midpoint (fractional grid coordinate).
 *
 * Only the EARLIEST collision per stream-pair is kept (prevents the same physical
 * collision being recorded twice as consecutive crossings or as crossing + same-cell).
 *
 * Both streams are truncated to stop at their respective collision segments.
 *
 * Exported for unit testing.
 */
export function resolveCollisions(
  streams: LaserStream[],
  streamOffsets: number[],
  mirrors: Mirror[]
): Position[] {
  // Map "x,y|globalTime" → arrivals (for same-cell detection)
  const byCellTime = new Map<string, ArrivalInfo[]>()
  // Map globalTime → all arrivals at that step (for crossing detection)
  const byTime = new Map<number, ArrivalInfo[]>()

  for (let si = 0; si < streams.length; si++) {
    const offset = streamOffsets[si]
    for (let segi = 0; segi < streams[si].segments.length; segi++) {
      const seg = streams[si].segments[segi]
      const gTime = offset + segi + 1
      const info: ArrivalInfo = { si, segi, dir: seg.direction, pos: { ...seg.end } }

      const ctKey = `${cellKey(seg.end)}|${gTime}`
      if (!byCellTime.has(ctKey)) byCellTime.set(ctKey, [])
      byCellTime.get(ctKey)!.push(info)

      if (!byTime.has(gTime)) byTime.set(gTime, [])
      byTime.get(gTime)!.push(info)
    }
  }

  const mirrorCells = new Set(mirrors.map((m) => cellKey(m.position)))

  // Per stream-pair: keep only the earliest collision (prevents double-detection of the
  // same physical event as both a crossing and same-cell, or as consecutive crossings).
  const pairCollisions = new Map<string, { gTime: number; pos: Position; a: ArrivalInfo; b: ArrivalInfo }>()

  function tryCollision(gTime: number, pos: Position, a: ArrivalInfo, b: ArrivalInfo) {
    const lo = Math.min(a.si, b.si), hi = Math.max(a.si, b.si)
    const key = `${lo}-${hi}`
    const existing = pairCollisions.get(key)
    if (!existing || gTime < existing.gTime) {
      pairCollisions.set(key, { gTime, pos, a, b })
    }
  }

  // 1. Same-cell same-time (exclude mirror cells — mirror handles each beam independently)
  for (const arrivals of byCellTime.values()) {
    if (arrivals.length < 2) continue
    for (let i = 0; i < arrivals.length; i++) {
      for (let j = i + 1; j < arrivals.length; j++) {
        const a = arrivals[i], b = arrivals[j]
        if (a.si !== b.si && a.dir === oppositeDir(b.dir) && !mirrorCells.has(cellKey(a.pos))) {
          const gTime = streamOffsets[a.si] + a.segi + 1
          tryCollision(gTime, a.pos, a, b)
        }
      }
    }
  }

  // 2. Crossing: at the same gTime, beam A at P heading to Q, beam B at Q heading to P
  for (const [gTime, arrivals] of byTime) {
    if (arrivals.length < 2) continue
    for (let i = 0; i < arrivals.length; i++) {
      for (let j = i + 1; j < arrivals.length; j++) {
        const a = arrivals[i], b = arrivals[j]
        if (a.si === b.si || a.dir !== oppositeDir(b.dir)) continue
        const delta = getDirectionDelta(a.dir)
        if (b.pos.x === a.pos.x + delta.dx && b.pos.y === a.pos.y + delta.dy) {
          tryCollision(gTime, { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 }, a, b)
        }
      }
    }
  }

  // Apply earliest truncation per stream, then collect collision positions
  const truncations = new Map<number, number>()
  const collisionPositions: Position[] = []

  for (const { pos, a, b } of pairCollisions.values()) {
    collisionPositions.push(pos)
    const prevA = truncations.get(a.si)
    truncations.set(a.si, prevA === undefined ? a.segi : Math.min(prevA, a.segi))
    const prevB = truncations.get(b.si)
    truncations.set(b.si, prevB === undefined ? b.segi : Math.min(prevB, b.segi))
  }

  for (const [si, maxSegi] of truncations) {
    streams[si].segments = streams[si].segments.slice(0, maxSegi + 1)
  }

  return collisionPositions
}

function findMirror(pos: Position, mirrors: Mirror[]): Mirror | undefined {
  return mirrors.find((m) => m.position.x === pos.x && m.position.y === pos.y)
}

interface StackItem {
  startPos: Position
  startDir: Direction
  generation: number
  globalOffset: number  // total steps from the laser source before this stream started
}

export function calculateLaserPath(
  laserConfig: LaserConfig,
  mirrors: Mirror[],
  obstacles: Obstacle[],
  bounds: GridBounds
): LaserPath {
  const streams: LaserStream[] = []
  const streamOffsets: number[] = []
  const visited = new Set<string>()
  let totalLength = 0
  let terminationReason: LaserPath['terminationReason'] = 'max-length'

  const stack: StackItem[] = [
    { startPos: { x: laserConfig.x, y: laserConfig.y }, startDir: laserConfig.direction, generation: 0, globalOffset: 0 },
  ]

  while (stack.length > 0) {
    const { startPos, startDir, generation, globalOffset } = stack.pop()!
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
          // Sub-streams inherit the global time at the split point
          const subOffset = globalOffset + streamSegments.length
          stack.push({ startPos: { ...nextPos }, startDir: action.dirs[0], generation: generation + 1, globalOffset: subOffset })
          stack.push({ startPos: { ...nextPos }, startDir: action.dirs[1], generation: generation + 1, globalOffset: subOffset })
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
    streamOffsets.push(globalOffset)
  }

  const collisionPoints = resolveCollisions(streams, streamOffsets, mirrors)

  // Count total segments after truncation; beams sharing a cell count independently
  const finalLength = streams.reduce((sum, st) => sum + st.segments.length, 0)

  return {
    streams,
    totalLength: finalLength,
    terminated: true,
    terminationReason,
    collisionPoints,
  }
}

export function calculateScore(laserPath: LaserPath): number {
  return laserPath.totalLength
}

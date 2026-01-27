import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ============= Solver Implementation =============

type Direction = 'up' | 'down' | 'left' | 'right'
type MirrorType = '/' | '\\'

interface Position { x: number; y: number }
interface Mirror { position: Position; type: MirrorType }
interface LaserConfig { x: number; y: number; direction: Direction }

const REFLECTIONS: Record<MirrorType, Record<Direction, Direction>> = {
  '\\': { right: 'down', up: 'left', left: 'up', down: 'right' },
  '/': { right: 'up', down: 'left', left: 'down', up: 'right' },
}

function getDirectionDelta(dir: Direction): { dx: number; dy: number } {
  const deltas: Record<Direction, { dx: number; dy: number }> = {
    up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
  }
  return deltas[dir]
}

function calculateLaserLength(
  laser: LaserConfig,
  mirrors: Mirror[],
  obstacles: Position[],
  width: number,
  height: number
): number {
  const visited = new Set<string>()
  let pos = { x: laser.x, y: laser.y }
  let dir = laser.direction
  let length = 0
  const maxLength = 1000

  while (length < maxLength) {
    const key = `${pos.x},${pos.y},${dir}`
    if (visited.has(key)) break
    visited.add(key)

    const delta = getDirectionDelta(dir)
    const next = { x: pos.x + delta.dx, y: pos.y + delta.dy }

    if (next.x < 0 || next.x >= width || next.y < 0 || next.y >= height) {
      length++
      break
    }

    if (obstacles.some(o => o.x === next.x && o.y === next.y)) {
      length++
      break
    }

    const mirror = mirrors.find(m => m.position.x === next.x && m.position.y === next.y)
    if (mirror) {
      dir = REFLECTIONS[mirror.type][dir]
    }

    length++
    pos = next
  }

  return length
}

function findOptimalScore(
  laser: LaserConfig,
  obstacles: Position[],
  mirrorsAvailable: number,
  width: number,
  height: number
): number {
  // Get all valid positions (not laser source, not obstacles)
  const validPositions: Position[] = []
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (x === laser.x && y === laser.y) continue
      if (obstacles.some(o => o.x === x && o.y === y)) continue
      validPositions.push({ x, y })
    }
  }

  let bestScore = 0
  const mirrorTypes: MirrorType[] = ['/', '\\']

  // For small number of mirrors, we can do exhaustive search with pruning
  // Use iterative deepening - try with fewer mirrors first
  for (let numMirrors = 1; numMirrors <= mirrorsAvailable; numMirrors++) {
    // Beam search: track top candidates at each depth
    const beamWidth = 500
    let candidates: { mirrors: Mirror[]; score: number }[] = [{ mirrors: [], score: 0 }]

    for (let depth = 0; depth < numMirrors; depth++) {
      const nextCandidates: { mirrors: Mirror[]; score: number }[] = []

      for (const candidate of candidates) {
        const usedPositions = new Set(candidate.mirrors.map(m => `${m.position.x},${m.position.y}`))

        for (const pos of validPositions) {
          if (usedPositions.has(`${pos.x},${pos.y}`)) continue

          for (const type of mirrorTypes) {
            const newMirrors = [...candidate.mirrors, { position: pos, type }]
            const score = calculateLaserLength(laser, newMirrors, obstacles, width, height)
            nextCandidates.push({ mirrors: newMirrors, score })

            if (score > bestScore) {
              bestScore = score
            }
          }
        }
      }

      // Keep top candidates for next iteration
      nextCandidates.sort((a, b) => b.score - a.score)
      candidates = nextCandidates.slice(0, beamWidth)
    }
  }

  // Also try random search to explore more of the space
  for (let i = 0; i < 10000; i++) {
    const mirrors: Mirror[] = []
    const usedPositions = new Set<string>()

    for (let m = 0; m < mirrorsAvailable; m++) {
      const availablePositions = validPositions.filter(p => !usedPositions.has(`${p.x},${p.y}`))
      if (availablePositions.length === 0) break

      const pos = availablePositions[Math.floor(Math.random() * availablePositions.length)]
      const type = mirrorTypes[Math.floor(Math.random() * 2)]
      mirrors.push({ position: pos, type })
      usedPositions.add(`${pos.x},${pos.y}`)
    }

    const score = calculateLaserLength(laser, mirrors, obstacles, width, height)
    if (score > bestScore) {
      bestScore = score
    }
  }

  return bestScore
}

// Generate levels for the past week and today
function generateLevels() {
  const levels = []
  const today = new Date()

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    // Generate varied level configurations
    const level = generateLevel(i, dateStr)
    levels.push(level)
  }

  return levels
}

// Grid dimensions for large puzzles
const GRID_WIDTH = 15
const GRID_HEIGHT = 20

function generateLevel(seed: number, date: string) {
  // Large puzzle configurations (15x20 grids with 10 mirrors)
  const configs = [
    {
      // Spiral Inward - A spiral pattern that forces the laser to wind through the grid
      name: 'Spiral Inward',
      laserConfig: { x: 0, y: 0, direction: 'right' as const },
      obstacles: [
        // Outer wall (top, leaving gap at right)
        ...Array.from({ length: 13 }, (_, i) => ({ x: i, y: 2 })),
        // Right wall going down
        ...Array.from({ length: 15 }, (_, i) => ({ x: 13, y: i + 2 })),
        // Bottom wall going left
        ...Array.from({ length: 11 }, (_, i) => ({ x: i + 3, y: 17 })),
        // Left wall going up
        ...Array.from({ length: 13 }, (_, i) => ({ x: 3, y: i + 5 })),
        // Inner spiral
        ...Array.from({ length: 8 }, (_, i) => ({ x: i + 3, y: 5 })),
        ...Array.from({ length: 9 }, (_, i) => ({ x: 10, y: i + 5 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: i + 6, y: 14 })),
        ...Array.from({ length: 7 }, (_, i) => ({ x: 6, y: i + 8 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 6, y: 8 })),
      ],
      mirrorsAvailable: 10,
    },
    {
      // Chamber Grid - A grid of interconnected chambers
      name: 'Chamber Grid',
      laserConfig: { x: 0, y: 8, direction: 'right' as const },
      obstacles: [
        // Vertical dividers (with gaps for passages)
        ...Array.from({ length: 5 }, (_, i) => ({ x: 4, y: i })),
        ...Array.from({ length: 4 }, (_, i) => ({ x: 4, y: i + 7 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: 4, y: i + 13 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: 9, y: i + 1 })),
        ...Array.from({ length: 4 }, (_, i) => ({ x: 9, y: i + 8 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: 9, y: i + 14 })),
        // Horizontal dividers (with gaps)
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 1, y: 5 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 6, y: 5 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 11, y: 5 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 1, y: 12 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 6, y: 12 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 11, y: 12 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 1, y: 17 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 6, y: 17 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 11, y: 17 })),
      ],
      mirrorsAvailable: 10,
    },
    {
      // Diagonal Barriers - Staggered diagonal walls creating a zigzag path
      name: 'Diagonal Barriers',
      laserConfig: { x: 0, y: 19, direction: 'up' as const },
      obstacles: [
        // Diagonal barrier 1 (bottom-left to middle)
        { x: 2, y: 17 }, { x: 3, y: 16 }, { x: 4, y: 15 }, { x: 5, y: 14 }, { x: 6, y: 13 },
        // Diagonal barrier 2 (right side)
        { x: 12, y: 15 }, { x: 11, y: 14 }, { x: 10, y: 13 }, { x: 9, y: 12 }, { x: 8, y: 11 },
        // Diagonal barrier 3
        { x: 3, y: 9 }, { x: 4, y: 8 }, { x: 5, y: 7 }, { x: 6, y: 6 }, { x: 7, y: 5 },
        // Diagonal barrier 4
        { x: 11, y: 7 }, { x: 10, y: 6 }, { x: 9, y: 5 }, { x: 8, y: 4 }, { x: 7, y: 3 },
        // Diagonal barrier 5 (top)
        { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 1 }, { x: 5, y: 0 },
        { x: 12, y: 2 }, { x: 13, y: 1 }, { x: 14, y: 0 },
        // Some blocking walls
        { x: 0, y: 10 }, { x: 1, y: 10 },
        { x: 13, y: 10 }, { x: 14, y: 10 },
      ],
      mirrorsAvailable: 10,
    },
    {
      // Fortress - A central fortress with outer defenses
      name: 'Fortress',
      laserConfig: { x: 7, y: 0, direction: 'down' as const },
      obstacles: [
        // Central fortress walls
        { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 },
        { x: 5, y: 9 }, { x: 9, y: 9 },
        { x: 5, y: 10 }, { x: 9, y: 10 },
        { x: 5, y: 11 }, { x: 6, y: 11 }, { x: 7, y: 11 }, { x: 8, y: 11 }, { x: 9, y: 11 },
        // Outer defense - top
        { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 }, { x: 11, y: 4 },
        // Outer defense - bottom
        { x: 3, y: 15 }, { x: 4, y: 15 }, { x: 5, y: 15 }, { x: 9, y: 15 }, { x: 10, y: 15 }, { x: 11, y: 15 },
        // Side towers
        ...Array.from({ length: 8 }, (_, i) => ({ x: 1, y: i + 6 })),
        ...Array.from({ length: 8 }, (_, i) => ({ x: 13, y: i + 6 })),
        // Corner blocks
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
        { x: 13, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 1 },
        { x: 0, y: 18 }, { x: 0, y: 19 }, { x: 1, y: 19 },
        { x: 14, y: 18 }, { x: 14, y: 19 }, { x: 13, y: 19 },
      ],
      mirrorsAvailable: 10,
    },
    {
      // Labyrinth - A maze-like pattern with many corridors
      name: 'Labyrinth',
      laserConfig: { x: 0, y: 1, direction: 'right' as const },
      obstacles: [
        // Horizontal walls
        ...Array.from({ length: 6 }, (_, i) => ({ x: i + 2, y: 3 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: i + 10, y: 3 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: i, y: 6 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: i + 7, y: 6 })),
        ...Array.from({ length: 6 }, (_, i) => ({ x: i + 3, y: 9 })),
        ...Array.from({ length: 4 }, (_, i) => ({ x: i + 11, y: 9 })),
        ...Array.from({ length: 4 }, (_, i) => ({ x: i, y: 12 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: i + 6, y: 12 })),
        ...Array.from({ length: 2 }, (_, i) => ({ x: i + 13, y: 12 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: i + 2, y: 15 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: i + 9, y: 15 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: i, y: 18 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 7, y: 18 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: i + 12, y: 18 })),
      ],
      mirrorsAvailable: 10,
    },
    {
      // Scattered Islands - Random-looking clusters of obstacles
      name: 'Scattered Islands',
      laserConfig: { x: 14, y: 10, direction: 'left' as const },
      obstacles: [
        // Island 1 (top-left)
        { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 },
        // Island 2 (top-right)
        { x: 11, y: 1 }, { x: 12, y: 1 }, { x: 11, y: 2 }, { x: 12, y: 2 }, { x: 13, y: 2 },
        // Island 3 (middle-left)
        { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 9 }, { x: 0, y: 10 }, { x: 1, y: 10 },
        // Island 4 (center)
        { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 6, y: 10 }, { x: 8, y: 10 }, { x: 6, y: 11 }, { x: 7, y: 11 }, { x: 8, y: 11 },
        // Island 5 (middle-right)
        { x: 12, y: 7 }, { x: 13, y: 7 }, { x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 },
        // Island 6 (bottom-left)
        { x: 2, y: 15 }, { x: 3, y: 15 }, { x: 4, y: 15 }, { x: 3, y: 16 }, { x: 3, y: 17 }, { x: 4, y: 17 },
        // Island 7 (bottom-center)
        { x: 8, y: 16 }, { x: 9, y: 16 }, { x: 10, y: 16 }, { x: 9, y: 17 },
        // Island 8 (bottom-right)
        { x: 12, y: 14 }, { x: 13, y: 14 }, { x: 12, y: 15 }, { x: 13, y: 15 }, { x: 14, y: 15 },
      ],
      mirrorsAvailable: 10,
    },
    {
      // Gauntlet - A challenging run through multiple barriers
      name: 'Gauntlet',
      laserConfig: { x: 0, y: 0, direction: 'down' as const },
      obstacles: [
        // Alternating horizontal barriers
        ...Array.from({ length: 10 }, (_, i) => ({ x: i + 2, y: 3 })),
        ...Array.from({ length: 10 }, (_, i) => ({ x: i + 3, y: 7 })),
        ...Array.from({ length: 10 }, (_, i) => ({ x: i + 2, y: 11 })),
        ...Array.from({ length: 10 }, (_, i) => ({ x: i + 3, y: 15 })),
        // Side barriers
        ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: i + 5 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: 14, y: i + 9 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: i + 13 })),
        ...Array.from({ length: 3 }, (_, i) => ({ x: 14, y: i + 17 })),
      ],
      mirrorsAvailable: 10,
    },
  ]

  const config = configs[seed % configs.length]

  console.log(`Computing optimal score for ${date} (${config.name})...`)
  const optimalScore = findOptimalScore(
    config.laserConfig,
    config.obstacles,
    config.mirrorsAvailable,
    GRID_WIDTH,
    GRID_HEIGHT
  )
  console.log(`  Optimal score: ${optimalScore}`)

  // Set thresholds relative to optimal: 1-star at 40%, 2-star at 70%, 3-star requires optimal
  const oneStarThreshold = Math.floor(optimalScore * 0.4)
  const twoStarThreshold = Math.floor(optimalScore * 0.7)

  return {
    date,
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    laserConfig: JSON.stringify(config.laserConfig),
    obstacles: JSON.stringify(config.obstacles),
    mirrorsAvailable: config.mirrorsAvailable,
    starThresholds: JSON.stringify([oneStarThreshold, twoStarThreshold, optimalScore]),
    optimalScore,
  }
}

async function main() {
  console.log('Seeding database...')

  // Clear existing levels
  await prisma.levelProgress.deleteMany()
  await prisma.level.deleteMany()

  // Create new levels
  const levels = generateLevels()

  for (const level of levels) {
    await prisma.level.create({
      data: level,
    })
    console.log(`Created level for ${level.date}`)
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

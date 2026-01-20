import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '../dev.db')

console.log('Database path:', dbPath)

const adapter = new PrismaBetterSqlite3({ url: dbPath })
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

function generateLevel(seed: number, date: string) {
  // Different configurations based on seed
  const configs = [
    {
      // Corridor run - horizontal walls create lanes
      laserConfig: { x: 0, y: 1, direction: 'right' as const },
      obstacles: [
        { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
        { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
        { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 8, y: 3 },
        { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 },
        { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 },
      ],
      mirrorsAvailable: 5,
      starThresholds: [12, 20, 28],
    },
    {
      // Zigzag barriers
      laserConfig: { x: 0, y: 0, direction: 'right' as const },
      obstacles: [
        { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 },
        { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 },
        { x: 7, y: 6 }, { x: 7, y: 7 }, { x: 7, y: 8 },
        { x: 2, y: 5 }, { x: 2, y: 6 },
        { x: 8, y: 2 }, { x: 9, y: 2 },
      ],
      mirrorsAvailable: 6,
      starThresholds: [14, 22, 30],
    },
    {
      // Central fortress
      laserConfig: { x: 0, y: 5, direction: 'right' as const },
      obstacles: [
        { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 },
        { x: 4, y: 4 }, { x: 6, y: 4 },
        { x: 4, y: 5 }, { x: 6, y: 5 },
        { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 },
        { x: 2, y: 2 }, { x: 8, y: 2 },
        { x: 2, y: 8 }, { x: 8, y: 8 },
      ],
      mirrorsAvailable: 5,
      starThresholds: [10, 18, 26],
    },
    {
      // Scattered maze
      laserConfig: { x: 0, y: 2, direction: 'right' as const },
      obstacles: [
        { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 },
        { x: 4, y: 0 }, { x: 4, y: 1 },
        { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 7, y: 5 },
        { x: 3, y: 6 }, { x: 3, y: 7 }, { x: 4, y: 7 },
        { x: 8, y: 1 }, { x: 8, y: 2 },
        { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 },
      ],
      mirrorsAvailable: 6,
      starThresholds: [14, 22, 32],
    },
    {
      // Cross pattern
      laserConfig: { x: 0, y: 9, direction: 'up' as const },
      obstacles: [
        { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 },
        { x: 5, y: 6 }, { x: 5, y: 7 }, { x: 5, y: 8 },
        { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 },
        { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 },
        { x: 1, y: 1 }, { x: 9, y: 1 },
        { x: 1, y: 9 }, { x: 9, y: 9 },
      ],
      mirrorsAvailable: 5,
      starThresholds: [12, 20, 28],
    },
    {
      // Spiral walls
      laserConfig: { x: 9, y: 0, direction: 'down' as const },
      obstacles: [
        { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 },
        { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 },
        { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 },
        { x: 7, y: 4 }, { x: 7, y: 5 },
        { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 },
      ],
      mirrorsAvailable: 6,
      starThresholds: [10, 16, 24],
    },
    {
      // Chamber maze
      laserConfig: { x: 0, y: 0, direction: 'down' as const },
      obstacles: [
        { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 },
        { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 },
        { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 },
        { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
        { x: 3, y: 6 }, { x: 3, y: 7 }, { x: 3, y: 8 },
        { x: 8, y: 4 }, { x: 8, y: 5 }, { x: 8, y: 6 }, { x: 8, y: 7 },
        { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 },
      ],
      mirrorsAvailable: 7,
      starThresholds: [16, 26, 38],
    },
  ]

  const config = configs[seed % configs.length]

  console.log(`Computing optimal score for ${date}...`)
  const optimalScore = findOptimalScore(
    config.laserConfig,
    config.obstacles,
    config.mirrorsAvailable,
    10,
    10
  )
  console.log(`  Optimal score: ${optimalScore}`)

  // Set thresholds relative to optimal: 1-star at 40%, 2-star at 70%, 3-star requires optimal
  const oneStarThreshold = Math.floor(optimalScore * 0.4)
  const twoStarThreshold = Math.floor(optimalScore * 0.7)

  return {
    date,
    gridWidth: 10,
    gridHeight: 10,
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

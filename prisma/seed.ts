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
      // Simple horizontal
      laserConfig: { x: 0, y: 5, direction: 'right' as const },
      obstacles: [
        { x: 5, y: 5 },
        { x: 7, y: 3 },
      ],
      mirrorsAvailable: 4,
      starThresholds: [8, 12, 18],
    },
    {
      // Corner challenge
      laserConfig: { x: 0, y: 0, direction: 'right' as const },
      obstacles: [
        { x: 4, y: 4 },
        { x: 5, y: 5 },
        { x: 6, y: 6 },
      ],
      mirrorsAvailable: 5,
      starThresholds: [10, 15, 22],
    },
    {
      // Vertical start
      laserConfig: { x: 5, y: 0, direction: 'down' as const },
      obstacles: [
        { x: 3, y: 3 },
        { x: 7, y: 7 },
      ],
      mirrorsAvailable: 4,
      starThresholds: [8, 14, 20],
    },
    {
      // Many obstacles
      laserConfig: { x: 0, y: 2, direction: 'right' as const },
      obstacles: [
        { x: 2, y: 2 },
        { x: 4, y: 4 },
        { x: 6, y: 2 },
        { x: 8, y: 6 },
      ],
      mirrorsAvailable: 6,
      starThresholds: [12, 18, 25],
    },
    {
      // Wide open
      laserConfig: { x: 0, y: 9, direction: 'right' as const },
      obstacles: [],
      mirrorsAvailable: 5,
      starThresholds: [15, 25, 35],
    },
    {
      // Diagonal challenge
      laserConfig: { x: 9, y: 0, direction: 'down' as const },
      obstacles: [
        { x: 3, y: 3 },
        { x: 5, y: 5 },
      ],
      mirrorsAvailable: 5,
      starThresholds: [10, 16, 24],
    },
    {
      // Maze-like
      laserConfig: { x: 0, y: 0, direction: 'down' as const },
      obstacles: [
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 4, y: 4 },
        { x: 6, y: 2 },
        { x: 8, y: 4 },
      ],
      mirrorsAvailable: 6,
      starThresholds: [14, 22, 30],
    },
  ]

  const config = configs[seed % configs.length]

  return {
    date,
    gridWidth: 10,
    gridHeight: 10,
    laserConfig: JSON.stringify(config.laserConfig),
    obstacles: JSON.stringify(config.obstacles),
    mirrorsAvailable: config.mirrorsAvailable,
    starThresholds: JSON.stringify(config.starThresholds),
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

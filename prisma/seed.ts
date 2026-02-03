import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface LevelJson {
  date: string
  gridWidth: number
  gridHeight: number
  laserConfig: { x: number; y: number; direction: string }
  obstacles: { x: number; y: number }[]
  mirrorsAvailable: number
  optimalScore: number
  optimalSolution?: { x: number; y: number; type: string }[]
}

async function main() {
  console.log('Seeding database from JSON files...')

  // Read all JSON files from solver/levels/
  const levelsDir = path.join(__dirname, '..', 'solver', 'levels')

  if (!fs.existsSync(levelsDir)) {
    console.error(`Error: Levels directory not found: ${levelsDir}`)
    console.error('Run "python generate_levels.py" in the solver/ directory first.')
    process.exit(1)
  }

  const files = fs.readdirSync(levelsDir).filter(f => f.endsWith('.json'))

  if (files.length === 0) {
    console.error('Error: No JSON files found in solver/levels/')
    console.error('Run "python generate_levels.py" in the solver/ directory first.')
    process.exit(1)
  }

  console.log(`Found ${files.length} level files`)

  for (const file of files) {
    const filePath = path.join(levelsDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const level: LevelJson = JSON.parse(content)

    // Upsert: update if date exists, create if not
    await prisma.level.upsert({
      where: { date: level.date },
      update: {
        gridWidth: level.gridWidth,
        gridHeight: level.gridHeight,
        laserConfig: JSON.stringify(level.laserConfig),
        obstacles: JSON.stringify(level.obstacles),
        mirrorsAvailable: level.mirrorsAvailable,
        starThresholds: JSON.stringify([]),
        optimalScore: level.optimalScore,
        optimalSolution: level.optimalSolution ? JSON.stringify(level.optimalSolution) : null,
      },
      create: {
        date: level.date,
        gridWidth: level.gridWidth,
        gridHeight: level.gridHeight,
        laserConfig: JSON.stringify(level.laserConfig),
        obstacles: JSON.stringify(level.obstacles),
        mirrorsAvailable: level.mirrorsAvailable,
        starThresholds: JSON.stringify([]),
        optimalScore: level.optimalScore,
        optimalSolution: level.optimalSolution ? JSON.stringify(level.optimalSolution) : null,
      },
    })
    console.log(`Upserted level for ${level.date}`)
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

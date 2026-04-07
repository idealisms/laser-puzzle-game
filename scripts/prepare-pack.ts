import * as fs from 'fs'
import * as path from 'path'

export interface PackConfig {
  name: string
  subtitle: string
  dailySiteUrl: string
  dailySiteName: string
  puzzles: string[]
}

export interface LevelData {
  date: string
  gridWidth: number
  gridHeight: number
  laserConfig: object
  obstacles: object[]
  mirrorsAvailable: number
  optimalScore: number
  optimalSolution?: object[]
}

export interface PuzzleIndexEntry {
  date: string
  name: string
  number: number
  optimalScore: number
}

/**
 * Build the index of puzzles for the pack.
 * Pure function — no I/O. Exported for unit testing.
 */
export function buildPuzzleIndex(
  pack: PackConfig,
  levels: Record<string, LevelData>,
  names: Record<string, string>
): PuzzleIndexEntry[] {
  return pack.puzzles.map((date, index) => ({
    date,
    name: names[date] ?? date,
    number: index + 1,
    optimalScore: levels[date]?.optimalScore ?? 0,
  }))
}

/**
 * Run the full prepare-pack pipeline.
 * Reads from levelsDir and puzzlesDir, writes to outputDir.
 */
export function runPreparePack(
  packPath: string,
  levelsDir: string,
  puzzlesDir: string,
  outputDir: string
): void {
  const pack: PackConfig = JSON.parse(fs.readFileSync(packPath, 'utf-8'))

  fs.mkdirSync(outputDir, { recursive: true })

  const levels: Record<string, LevelData> = {}
  const names: Record<string, string> = {}

  for (const date of pack.puzzles) {
    // Read level data (solver output)
    const levelPath = path.join(levelsDir, `${date}.json`)
    if (!fs.existsSync(levelPath)) {
      throw new Error(`Level file not found: ${levelPath}`)
    }
    const levelData: LevelData = JSON.parse(fs.readFileSync(levelPath, 'utf-8'))
    levels[date] = levelData

    // Read puzzle name from puzzle config
    const puzzlePath = path.join(puzzlesDir, `${date}.json`)
    if (fs.existsSync(puzzlePath)) {
      const puzzleConfig = JSON.parse(fs.readFileSync(puzzlePath, 'utf-8'))
      names[date] = puzzleConfig.name ?? date
    } else {
      names[date] = date
    }

    // Write level JSON (with name injected) to output dir
    const outLevel = { ...levelData, name: names[date] }
    const outPath = path.join(outputDir, `${date}.json`)
    fs.writeFileSync(outPath, JSON.stringify(outLevel))
    console.log(`  Wrote ${outPath}`)
  }

  // Write index.json
  const index = buildPuzzleIndex(pack, levels, names)
  const indexPath = path.join(outputDir, 'index.json')
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))
  console.log(`  Wrote ${indexPath}`)

  console.log(`\nPrepared ${pack.puzzles.length} puzzles in ${outputDir}`)
}

// Run when executed directly
if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..')
  runPreparePack(
    path.join(repoRoot, 'puzzle-packs', 'pack.json'),
    path.join(repoRoot, 'solver', 'levels'),
    path.join(repoRoot, 'solver', 'puzzles'),
    path.join(repoRoot, 'public', 'puzzles')
  )
}

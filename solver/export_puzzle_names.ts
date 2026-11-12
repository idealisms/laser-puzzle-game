/**
 * Writes src/data/puzzle-names.json ({ "YYYY-MM-DD": "Name" }) from the puzzle
 * maps, for page titles and link previews. generate_levels.ts runs this after
 * solving; run it by hand after renaming a puzzle:
 *   cd solver && npx tsx export_puzzle_names.ts
 * src/lib/puzzleInfo.test.ts fails if the file is out of date.
 */
const fs = require('fs');
const path = require('path');
const { PUZZLES } = require('./puzzles');

function exportPuzzleNames(): string {
  const names: Record<string, string> = {};
  for (const date of Object.keys(PUZZLES).sort()) names[date] = PUZZLES[date].name;
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'puzzle-names.json');
  fs.writeFileSync(outputPath, JSON.stringify(names, null, 2) + '\n');
  return outputPath;
}

if (require.main === module) {
  console.log(`Wrote ${exportPuzzleNames()}`);
}

module.exports = { exportPuzzleNames };

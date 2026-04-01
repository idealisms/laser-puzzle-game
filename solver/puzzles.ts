'use strict';
/**
 * Puzzle configurations loaded from solver/puzzles/*.json.
 *
 * Each JSON file has obstacle_groups (with "label" strings preserving the
 * original comments) which are flattened into a plain obstacles array here.
 * Splitters are mapped from {x,y,dir} objects to [x, y, dir] triples.
 */

const fs = require('fs');
const path = require('path');

const DIR: Record<string, number> = { up: 0, right: 1, down: 2, left: 3 };

interface PuzzleConfig {
  name: string;
  width: number;
  height: number;
  laserX: number;
  laserY: number;
  laserDir: number;
  obstacles: [number, number][];
  numMirrors: number;
  splitters: [number, number, string][];
  gates: [number, number, string][];
}

function loadPuzzles(): Record<string, PuzzleConfig> {
  const puzzlesDir = path.join(__dirname, 'puzzles');
  const configs: Record<string, PuzzleConfig> = {};

  for (const file of fs.readdirSync(puzzlesDir).sort()) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(puzzlesDir, file), 'utf8'));

    const obstacles: [number, number][] = data.obstacle_groups.flatMap(g => g.cells);
    const splitters: [number, number, string][] = (data.splitters || []).map(s => [s.x, s.y, s.dir]);
    const gates: [number, number, string][] = (data.gates || []).map(g => [g.x, g.y, g.dir]);

    configs[data.date] = {
      name: data.name,
      width: data.width,
      height: data.height,
      laserX: data.laser.x,
      laserY: data.laser.y,
      laserDir: DIR[data.laser.dir],
      obstacles,
      numMirrors: data.num_mirrors,
      splitters,
      gates,
    };
  }

  return configs;
}

const PUZZLES = loadPuzzles();

module.exports = { PUZZLES };

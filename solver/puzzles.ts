'use strict';
/**
 * Puzzle configurations loaded from the maps in solver/puzzles/*.txt (format
 * in puzzle_map.ts).
 *
 * Obstacle groups are flattened into a plain obstacles array, and splitters
 * and gates become [x, y, dir] triples.
 */

const fs = require('fs');
const path = require('path');
const { parseMap } = require('./puzzle_map');

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
    if (!file.endsWith('.txt')) continue;
    const date = file.slice(0, -'.txt'.length);
    let data;
    try {
      data = parseMap(fs.readFileSync(path.join(puzzlesDir, file), 'utf8'), date);
    } catch (err) {
      throw new Error(`solver/puzzles/${file}: ${err.message}`);
    }

    const obstacles: [number, number][] = data.obstacle_groups.flatMap(g => g.cells);
    const splitters: [number, number, string][] = data.splitters.map(s => [s.x, s.y, s.dir]);
    const gates: [number, number, string][] = data.gates.map(g => [g.x, g.y, g.dir]);

    configs[date] = {
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

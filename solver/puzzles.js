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

const DIR = { up: 0, right: 1, down: 2, left: 3 };

function loadPuzzles() {
  const puzzlesDir = path.join(__dirname, 'puzzles');
  const configs = {};

  for (const file of fs.readdirSync(puzzlesDir).sort()) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(puzzlesDir, file), 'utf8'));

    const obstacles = data.obstacle_groups.flatMap(g => g.cells);
    const splitters = (data.splitters || []).map(s => [s.x, s.y, s.dir]);

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
    };
  }

  return configs;
}

const PUZZLES = loadPuzzles();

module.exports = { PUZZLES };

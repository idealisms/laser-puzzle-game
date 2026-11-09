// The game's Obstacle[] for a solver config (puzzles.ts).
// ES module syntax so the ES-style solver files can import it; tsx still lets
// the CommonJS ones require() it.
import type { Direction, Obstacle } from '../src/game/types';

export interface ObstacleConfig {
  obstacles: [number, number][];
  splitters?: [number, number, string][];
  gates?: [number, number, string][];
  portals?: [number, number, number][];
}

/** Plain walls ({x, y}), then splitters, gates and portals: the obstacles array of a level JSON file. */
export function configToObstacles(config: ObstacleConfig): Obstacle[] {
  return [
    ...config.obstacles.map(([x, y]) => ({ x, y })),
    ...(config.splitters || []).map(([x, y, o]) => ({ x, y, type: 'splitter' as const, orientation: o as Direction })),
    ...(config.gates || []).map(([x, y, o]) => ({ x, y, type: 'gate' as const, orientation: o as Direction })),
    ...(config.portals || []).map(([x, y, pair]) => ({ x, y, type: 'portal' as const, pair })),
  ];
}

/** Every cell a mirror can't go on, as "x,y" keys: obstacles of any kind and the laser. */
export function occupiedCells(config: ObstacleConfig & { laserX: number; laserY: number }): Set<string> {
  return new Set([...configToObstacles(config).map(o => `${o.x},${o.y}`), `${config.laserX},${config.laserY}`]);
}

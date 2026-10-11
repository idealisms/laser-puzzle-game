'use strict';
/**
 * fastsim.ts — Allocation-free scorer for the beam search.
 *
 * Computes exactly the same totalLength as calculateLaserPath in
 * src/game/engine/simulate.ts (splitters, gates, loops, the shared
 * MAX_LASER_LENGTH cap and collisions), but on integer-encoded grids with
 * preallocated buffers, so a simulation does no heap allocation.
 * test_fastsim.ts keeps the two in sync by comparing them on random mirror
 * placements for every puzzle.
 *
 * Like simulate.ts, all beams advance one cell per time step; beams that
 * collide on arrival both stop, and a stopped beam spawns nothing further.
 */

const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const OPP = [DOWN, LEFT, UP, RIGHT];
// REFLECT[type][dir], type 1 = '/', 2 = '\'
const REFLECT = [[], [RIGHT, UP, LEFT, DOWN], [LEFT, DOWN, RIGHT, UP]];
// MIRROR_SIDE[type][dir]: which face of the mirror an incoming beam hits.
const MIRROR_SIDE = [[], [0, 1, 1, 0], [0, 0, 1, 1]];
const DIR_TO_INT: Record<string, number> = { up: UP, right: RIGHT, down: DOWN, left: LEFT };

const MAX_LENGTH = 1000; // MAX_LASER_LENGTH in src/game/constants.ts
const MAX_BEAMS = 64; // live beams at once; each splitter can split at most once
const OUT_CONTINUE = 0, OUT_STOP = 1, OUT_SPLIT = 2;

const CELL_EMPTY = 0, CELL_WALL = 1, CELL_SPLITTER = 2, CELL_GATE = 3;

export const MIRROR_SLASH = 1, MIRROR_BACKSLASH = 2;

export interface FastSim {
  width: number;
  height: number;
  /** Mirror grid, indexed x*height+y: 0 = none, 1 = '/', 2 = '\'. Mutated by callers. */
  mirrors: Int8Array;
  /** Scores the current mirror grid. If `cellsOut` is given, fills it with a bitset
   *  of every in-bounds cell (bit x*height+y) any beam enters. */
  run(cellsOut?: Uint8Array | null): number;
  /** Number of bytes needed for a cell bitset. */
  cellBytes: number;
}

export function createFastSim(config: any): FastSim {
  const W: number = config.width, H: number = config.height;
  const N = W * H;
  const kind = new Int8Array(N);
  const orient = new Int8Array(N);
  for (const [x, y] of config.obstacles) kind[x * H + y] = CELL_WALL;
  for (const [x, y, o] of config.splitters || []) { kind[x * H + y] = CELL_SPLITTER; orient[x * H + y] = DIR_TO_INT[o]; }
  for (const [x, y, o] of config.gates || []) { kind[x * H + y] = CELL_GATE; orient[x * H + y] = DIR_TO_INT[o]; }

  const mirrors = new Int8Array(N);
  const laserX: number = config.laserX, laserY: number = config.laserY, laserDir: number = config.laserDir;

  // Visited (pos, dir) stamps — avoids clearing between runs.
  const visited = new Uint32Array(N * 4);
  let stamp = 0;

  // Live beams, double-buffered: position and direction.
  let bx = new Int32Array(MAX_BEAMS), by = new Int32Array(MAX_BEAMS), bd = new Int32Array(MAX_BEAMS);
  let nx2 = new Int32Array(MAX_BEAMS), ny2 = new Int32Array(MAX_BEAMS), nd2 = new Int32Array(MAX_BEAMS);
  // This step's arrivals.
  const ax = new Int32Array(MAX_BEAMS), ay = new Int32Array(MAX_BEAMS);
  const adir = new Int32Array(MAX_BEAMS);    // direction of travel into the cell
  const aout = new Int32Array(MAX_BEAMS);    // OUT_* outcome
  const anew = new Int32Array(MAX_BEAMS);    // new direction for OUT_CONTINUE
  const ahit = new Uint8Array(MAX_BEAMS);    // collided this step

  // Do two beams arriving at (x, y) (possibly off-grid) travelling da and db collide?
  function sameCellCollides(x: number, y: number, da: number, db: number): boolean {
    if (x >= 0 && x < W && y >= 0 && y < H) {
      const c = x * H + y;
      const m = mirrors[c];
      if (m) return MIRROR_SIDE[m][da] === MIRROR_SIDE[m][db];
      if (kind[c] === CELL_SPLITTER) {
        const wall = OPP[orient[c]];
        return da !== wall && db !== wall;
      }
    }
    return da === db || da === OPP[db];
  }

  function run(cellsOut?: Uint8Array | null): number {
    stamp++;
    if (stamp === 0xFFFFFFFF) { visited.fill(0); stamp = 1; }
    if (cellsOut) cellsOut.fill(0);

    let total = 0;
    let n = 1;
    bx[0] = laserX; by[0] = laserY; bd[0] = laserDir;

    while (n > 0) {
      // 1. Move every beam one cell.
      let na = 0;
      for (let i = 0; i < n; i++) {
        if (total >= MAX_LENGTH) break;
        const x = bx[i], y = by[i], dir = bd[i];
        const vk = (x * H + y) * 4 + dir;
        if (visited[vk] === stamp) continue;
        visited[vk] = stamp;

        const tx = x + DX[dir], ty = y + DY[dir];
        total++;
        let out = OUT_CONTINUE, nd = dir;
        if (tx < 0 || tx >= W || ty < 0 || ty >= H) {
          out = OUT_STOP;
        } else {
          const c = tx * H + ty;
          if (cellsOut) cellsOut[c >> 3] |= 1 << (c & 7);
          const k = kind[c];
          if (k === CELL_EMPTY) {
            const m = mirrors[c];
            if (m) nd = REFLECT[m][dir];
          } else if (k === CELL_WALL) {
            out = OUT_STOP;
          } else {
            const o = orient[c];
            if (k === CELL_GATE) { if (dir !== o) out = OUT_STOP; }
            else if (dir === o) out = OUT_SPLIT;
            else if (dir === OPP[o]) out = OUT_STOP;
            else nd = OPP[o];
          }
        }
        ax[na] = tx; ay[na] = ty; adir[na] = dir; aout[na] = out; anew[na] = nd; ahit[na] = 0;
        na++;
      }

      // 2. Collisions between beams arriving at the same cell.
      if (na > 1) {
        for (let i = 0; i < na; i++)
          for (let j = i + 1; j < na; j++)
            if (ax[i] === ax[j] && ay[i] === ay[j] && sameCellCollides(ax[i], ay[i], adir[i], adir[j]))
              ahit[i] = ahit[j] = 1;
      }

      // 3. Surviving beams continue or split.
      let m = 0;
      for (let i = 0; i < na; i++) {
        if (ahit[i] || aout[i] === OUT_STOP) continue;
        if (aout[i] === OUT_SPLIT) {
          const horiz = adir[i] === LEFT || adir[i] === RIGHT;
          nx2[m] = ax[i]; ny2[m] = ay[i]; nd2[m] = horiz ? DOWN : RIGHT; m++;
          nx2[m] = ax[i]; ny2[m] = ay[i]; nd2[m] = horiz ? UP : LEFT; m++;
        } else {
          nx2[m] = ax[i]; ny2[m] = ay[i]; nd2[m] = anew[i]; m++;
        }
      }
      let t = bx; bx = nx2; nx2 = t;
      t = by; by = ny2; ny2 = t;
      t = bd; bd = nd2; nd2 = t;
      n = m;
    }
    return total;
  }

  return { width: W, height: H, mirrors, run, cellBytes: (N + 7) >> 3 };
}

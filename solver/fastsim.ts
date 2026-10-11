'use strict';
/**
 * fastsim.ts — Allocation-free scorer for the beam search.
 *
 * Computes exactly the same totalLength as calculateLaserPath in
 * src/game/engine/simulate.ts (splitters, gates, loops, the shared
 * MAX_LASER_LENGTH cap and collision truncation), but on integer-encoded grids
 * with preallocated buffers, so a simulation does no heap allocation.
 * Kept in lockstep with simulate.ts by test_fastsim.ts, which compares the two
 * on random mirror placements for every puzzle.
 *
 * Collision semantics (matching resolveCollisions): for each stream, find the
 * earliest global time at which it collides with any other stream; the stream
 * keeps its segments up to and including that time. Truncating a stream does
 * not remove sub-streams it already spawned.
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
const MAX_STREAMS = 64;

const CELL_EMPTY = 0, CELL_WALL = 1, CELL_SPLITTER = 2, CELL_GATE = 3;

export const MIRROR_SLASH = 1, MIRROR_BACKSLASH = 2;

export interface FastSim {
  width: number;
  height: number;
  /** Mirror grid, indexed x*height+y: 0 = none, 1 = '/', 2 = '\'. Mutated by callers. */
  mirrors: Int8Array;
  /** Scores the current mirror grid. If `cellsOut` is given, fills it with a bitset
   *  of every in-bounds cell (bit x*height+y) the surviving beams enter. */
  run(cellsOut?: Uint8Array | null): number;
  /** Number of bytes needed for a cell bitset. */
  cellBytes: number;
}

export function createFastSim(config: any): FastSim {
  const W: number = config.width, H: number = config.height;
  const N = W * H;
  // Extended grid with a 2-cell border: holds off-grid segment ends (edge exits)
  // and keeps the crossing check's neighbour lookup from wrapping columns.
  const EH = H + 4;
  const ext = (x: number, y: number) => (x + 2) * EH + (y + 2);

  const kind = new Int8Array(N);
  const orient = new Int8Array(N);
  for (const [x, y] of config.obstacles) kind[x * H + y] = CELL_WALL;
  for (const [x, y, o] of config.splitters || []) { kind[x * H + y] = CELL_SPLITTER; orient[x * H + y] = DIR_TO_INT[o]; }
  for (const [x, y, o] of config.gates || []) { kind[x * H + y] = CELL_GATE; orient[x * H + y] = DIR_TO_INT[o]; }

  const mirrors = new Int8Array(N);
  const laserX: number = config.laserX, laserY: number = config.laserY, laserDir: number = config.laserDir;
  const hasSplitters = (config.splitters || []).length > 0;

  // Visited (pos, dir) stamps — avoids clearing between runs.
  const visited = new Uint32Array(N * 4);
  let stamp = 0;

  // Step buffers: every segment end across all streams (at most MAX_LENGTH).
  const stepCell = new Int16Array(MAX_LENGTH);  // extended-grid index of segment end
  const stepDir = new Int8Array(MAX_LENGTH);   // direction of travel into that cell
  // Stream table
  const sStart = new Int32Array(MAX_STREAMS);  // index into step buffers
  const sLen = new Int32Array(MAX_STREAMS);
  const sOffset = new Int32Array(MAX_STREAMS); // global time before first step
  const sCut = new Int32Array(MAX_STREAMS);    // earliest collision time (or large)
  // Pending stack: [x, y, dir, globalOffset]
  const stack = new Int32Array(MAX_STREAMS * 4);

  // Classify a same-cell, same-time meeting of two beams (directions da, db).
  function sameCellCollides(cellExt: number, da: number, db: number): boolean {
    const x = Math.floor(cellExt / EH) - 2, y = (cellExt % EH) - 2;
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

    let total = 0, nStreams = 0, sp = 0;
    stack[0] = laserX; stack[1] = laserY; stack[2] = laserDir; stack[3] = 0; sp = 1;

    while (sp > 0) {
      sp--;
      let x = stack[sp * 4], y = stack[sp * 4 + 1], dir = stack[sp * 4 + 2];
      const offset = stack[sp * 4 + 3];
      const si = nStreams++;
      sStart[si] = total; sOffset[si] = offset;

      while (total < MAX_LENGTH) {
        const vk = (x * H + y) * 4 + dir;
        if (visited[vk] === stamp) break;
        visited[vk] = stamp;

        const nx = x + DX[dir], ny = y + DY[dir];
        stepCell[total] = ext(nx, ny); stepDir[total] = dir; total++;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) break;

        const c = nx * H + ny;
        const k = kind[c];
        if (k !== CELL_EMPTY) {
          if (k === CELL_WALL) break;
          const o = orient[c];
          if (k === CELL_GATE) {
            if (dir !== o) break;
          } else if (dir === o) {
            // Split: push dirs[0] then dirs[1] so dirs[1] runs first (as in simulate.ts).
            const subOffset = offset + (total - sStart[si]);
            const d0 = (dir === LEFT || dir === RIGHT) ? UP : LEFT;
            const d1 = (dir === LEFT || dir === RIGHT) ? DOWN : RIGHT;
            stack[sp * 4] = nx; stack[sp * 4 + 1] = ny; stack[sp * 4 + 2] = d0; stack[sp * 4 + 3] = subOffset; sp++;
            stack[sp * 4] = nx; stack[sp * 4 + 1] = ny; stack[sp * 4 + 2] = d1; stack[sp * 4 + 3] = subOffset; sp++;
            break;
          } else if (dir === OPP[o]) {
            break;
          } else {
            dir = OPP[o];
          }
        } else {
          const m = mirrors[c];
          if (m) dir = REFLECT[m][dir];
        }
        x = nx; y = ny;
      }
      sLen[si] = total - sStart[si];
    }

    let score = total;
    if (hasSplitters && nStreams > 1) {
      for (let i = 0; i < nStreams; i++) sCut[i] = 0x7FFFFFFF;
      // Pairwise scan for each pair's earliest collision. Time of step j of
      // stream s is sOffset[s] + j + 1.
      for (let a = 0; a < nStreams; a++) {
        for (let b = a + 1; b < nStreams; b++) {
          const lo = Math.max(sOffset[a], sOffset[b]) + 1;
          const hi = Math.min(sOffset[a] + sLen[a], sOffset[b] + sLen[b]);
          for (let t = lo; t <= hi; t++) {
            const ia = sStart[a] + (t - sOffset[a] - 1);
            const ib = sStart[b] + (t - sOffset[b] - 1);
            const ca = stepCell[ia], cb = stepCell[ib];
            const da = stepDir[ia], db = stepDir[ib];
            let hit = false;
            if (ca === cb) {
              hit = sameCellCollides(ca, da, db);
            } else if (da === OPP[db]) {
              // Crossing: a at P heading to Q, b at Q heading to P.
              hit = cb === ca + DX[da] * EH + DY[da];
            }
            if (hit) {
              if (t < sCut[a]) sCut[a] = t;
              if (t < sCut[b]) sCut[b] = t;
              break;
            }
          }
        }
      }
      score = 0;
      for (let i = 0; i < nStreams; i++) {
        const keep = Math.min(sLen[i], sCut[i] - sOffset[i]);
        sLen[i] = keep;
        score += keep;
      }
    }

    if (cellsOut) {
      cellsOut.fill(0);
      for (let i = 0; i < nStreams; i++) {
        const end = sStart[i] + sLen[i];
        for (let j = sStart[i]; j < end; j++) {
          const e = stepCell[j];
          const x = Math.floor(e / EH) - 2, y = (e % EH) - 2;
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const c = x * H + y;
          cellsOut[c >> 3] |= 1 << (c & 7);
        }
      }
    }
    return score;
  }

  return { width: W, height: H, mirrors, run, cellBytes: (N + 7) >> 3 };
}

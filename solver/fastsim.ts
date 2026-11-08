'use strict';
/**
 * fastsim.ts — Allocation-free scorer for the beam search.
 *
 * Computes exactly the same totalLength as calculateLaserPath in
 * src/game/engine/simulate.ts (splitters, gates, portals, loops, the shared
 * MAX_LASER_LENGTH cap and collisions), but on integer-encoded grids with
 * preallocated buffers, so a simulation does no heap allocation.
 * test_fastsim.ts keeps the two in sync by comparing them on random mirror
 * placements for every puzzle.
 *
 * Like simulate.ts, all beams advance one cell per time step; beams that
 * collide on arrival both stop, and a stopped beam spawns nothing further.
 * Cells stay lit after a beam passes, and a later beam entering a lit cell
 * stops if it would collide with the beam lighting it. A beam entering a
 * portal leaves its twin; portals are holes that are never lit and where
 * beams going in never collide. Two beams that pass each other head-on
 * through a portal pair become partners and never collide with each other.
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

const CELL_EMPTY = 0, CELL_WALL = 1, CELL_SPLITTER = 2, CELL_GATE = 3, CELL_PORTAL = 4;

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
  // Portals: twin[c] is the cell a beam entering portal c leaves from.
  const twin = new Int32Array(N).fill(-1);
  const portals: [number, number, number][] = config.portals || [];
  for (const [x, y, pair] of portals) {
    const other = portals.find(([x2, y2, p2]) => p2 === pair && (x2 !== x || y2 !== y));
    if (!other) continue;
    const c = x * H + y, t = other[0] * H + other[1];
    kind[c] = CELL_PORTAL;
    twin[c] = t;
  }

  const mirrors = new Int8Array(N);
  const laserX: number = config.laserX, laserY: number = config.laserY, laserDir: number = config.laserDir;

  // Visited (pos, dir) stamps — avoids clearing between runs.
  const visited = new Uint32Array(N * 4);
  let stamp = 0;
  // Lit cells: bit d of litDirs[c] is set when a beam travelling d has entered
  // cell c this run (valid only where litStamp[c] === stamp).
  const litStamp = new Uint32Array(N);
  const litDirs = new Uint8Array(N);
  // Id of the beam that lit cell c travelling d, at litId[c * 4 + d] (only
  // one beam can, by loop detection).
  const litId = new Int32Array(N * 4);
  // Portal entries: pentId[c * 4 + d] is the beam that went into portal c
  // travelling d, valid where pentStamp matches.
  const pentStamp = new Uint32Array(N * 4);
  const pentId = new Int32Array(N * 4);
  // Partner pairs (beams that passed each other through a portal).
  const MAX_PARTNERS = 4096;
  const partnerA = new Int32Array(MAX_PARTNERS), partnerB = new Int32Array(MAX_PARTNERS);
  let numPartners = 0;
  const arePartners = (a: number, b: number) => {
    for (let p = 0; p < numPartners; p++)
      if ((partnerA[p] === a && partnerB[p] === b) || (partnerA[p] === b && partnerB[p] === a)) return true;
    return false;
  };

  // Live beams, double-buffered: position, direction, id and the portal cell
  // the beam is coming out of on its next step (-1 if none).
  let bx = new Int32Array(MAX_BEAMS), by = new Int32Array(MAX_BEAMS), bd = new Int32Array(MAX_BEAMS);
  let nx2 = new Int32Array(MAX_BEAMS), ny2 = new Int32Array(MAX_BEAMS), nd2 = new Int32Array(MAX_BEAMS);
  let bid = new Int32Array(MAX_BEAMS), bem = new Int32Array(MAX_BEAMS);
  let nid2 = new Int32Array(MAX_BEAMS), nem2 = new Int32Array(MAX_BEAMS);
  // This step's arrivals.
  const ax = new Int32Array(MAX_BEAMS), ay = new Int32Array(MAX_BEAMS);  // cell entered
  const ak = new Int32Array(MAX_BEAMS);      // cell entered as an index (unique negative key off-grid)
  const apx = new Int32Array(MAX_BEAMS), apy = new Int32Array(MAX_BEAMS);  // where the beam is after the step
  const adir = new Int32Array(MAX_BEAMS);    // direction of travel into the cell
  const aout = new Int32Array(MAX_BEAMS);    // OUT_* outcome
  const anew = new Int32Array(MAX_BEAMS);    // new direction for OUT_CONTINUE
  const ahit = new Uint8Array(MAX_BEAMS);    // collided this step
  const aid = new Int32Array(MAX_BEAMS);     // beam id
  const aem = new Int32Array(MAX_BEAMS);     // portal cell the beam came out of this step, or -1
  const anem = new Int32Array(MAX_BEAMS);    // portal cell it will come out of next step, or -1

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
    if (stamp === 0xFFFFFFFF) { visited.fill(0); litStamp.fill(0); stamp = 1; }
    if (cellsOut) cellsOut.fill(0);

    let total = 0;
    let n = 1;
    let nextId = 1;
    numPartners = 0;
    bx[0] = laserX; by[0] = laserY; bd[0] = laserDir; bid[0] = 0; bem[0] = -1;

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
        let out = OUT_CONTINUE, nd = dir, px = tx, py = ty, key: number, nem = -1;
        if (tx < 0 || tx >= W || ty < 0 || ty >= H) {
          out = OUT_STOP;
          key = -1 - ((tx + 1) * (H + 2) + (ty + 1)); // unique per off-grid cell
        } else {
          const c = tx * H + ty;
          key = c;
          if (cellsOut) cellsOut[c >> 3] |= 1 << (c & 7);
          const k = kind[c];
          if (k === CELL_EMPTY) {
            const m = mirrors[c];
            if (m) nd = REFLECT[m][dir];
          } else if (k === CELL_WALL) {
            out = OUT_STOP;
          } else if (k === CELL_PORTAL) {
            const t = twin[c];
            px = (t / H) | 0; py = t - px * H;
            nem = t;
            pentStamp[c * 4 + dir] = stamp; pentId[c * 4 + dir] = bid[i];
          } else {
            const o = orient[c];
            if (k === CELL_GATE) { if (dir !== o) out = OUT_STOP; }
            else if (dir === o) out = OUT_SPLIT;
            else if (dir === OPP[o]) out = OUT_STOP;
            else nd = OPP[o];
          }
        }
        ax[na] = tx; ay[na] = ty; ak[na] = key; apx[na] = px; apy[na] = py;
        adir[na] = dir; aout[na] = out; anew[na] = nd; ahit[na] = 0;
        aid[na] = bid[i]; aem[na] = bem[i]; anem[na] = nem;
        na++;
      }

      // 2. Collisions between beams arriving at the same cell.
      if (na > 1) {
        for (let i = 0; i < na; i++) {
          if (anem[i] >= 0) continue; // going into a portal: never collides there
          for (let j = i + 1; j < na; j++)
            if (ak[i] === ak[j] && sameCellCollides(ax[i], ay[i], adir[i], adir[j]) &&
                (numPartners === 0 || !arePartners(aid[i], aid[j])))
              ahit[i] = ahit[j] = 1;
        }
      }

      // 3. Collisions with beams that entered the cell at an earlier step.
      for (let i = 0; i < na; i++) {
        if (ahit[i] || anem[i] >= 0) continue;
        const x = ax[i], y = ay[i];
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const c = ak[i];
        if (litStamp[c] !== stamp) continue;
        const lit = litDirs[c];
        // Check every earlier beam (no early exit), recording partners the
        // same way as simulate.ts.
        for (let d = 0; d < 4; d++) {
          if (d === adir[i] || !(lit & (1 << d)) || !sameCellCollides(x, y, d, adir[i])) continue;
          const other = litId[c * 4 + d];
          if (numPartners > 0 && arePartners(aid[i], other)) continue;
          // Coming out of portal e head-on to a beam that went into e: they pass.
          const e = aem[i];
          if (e >= 0 && d === OPP[adir[i]] && pentStamp[e * 4 + d] === stamp && pentId[e * 4 + d] === other) {
            if (numPartners === MAX_PARTNERS) throw new Error('fastsim: too many partner beams');
            partnerA[numPartners] = aid[i]; partnerB[numPartners] = other; numPartners++;
            continue;
          }
          ahit[i] = 1;
        }
      }

      // 4. Beams that got into their cell light it.
      for (let i = 0; i < na; i++) {
        if (aout[i] === OUT_STOP || anem[i] >= 0) continue;
        const c = ak[i];
        if (litStamp[c] !== stamp) { litStamp[c] = stamp; litDirs[c] = 0; }
        litDirs[c] |= 1 << adir[i];
        litId[c * 4 + adir[i]] = aid[i];
      }

      // 5. Surviving beams continue or split.
      let m = 0;
      for (let i = 0; i < na; i++) {
        if (ahit[i] || aout[i] === OUT_STOP) continue;
        if (aout[i] === OUT_SPLIT) {
          const horiz = adir[i] === LEFT || adir[i] === RIGHT;
          nx2[m] = ax[i]; ny2[m] = ay[i]; nd2[m] = horiz ? DOWN : RIGHT; nid2[m] = nextId++; nem2[m] = -1; m++;
          nx2[m] = ax[i]; ny2[m] = ay[i]; nd2[m] = horiz ? UP : LEFT; nid2[m] = nextId++; nem2[m] = -1; m++;
        } else {
          nx2[m] = apx[i]; ny2[m] = apy[i]; nd2[m] = anew[i]; nid2[m] = aid[i]; nem2[m] = anem[i]; m++;
        }
      }
      let t = bx; bx = nx2; nx2 = t;
      t = by; by = ny2; ny2 = t;
      t = bd; bd = nd2; nd2 = t;
      t = bid; bid = nid2; nid2 = t;
      t = bem; bem = nem2; nem2 = t;
      n = m;
    }
    return total;
  }

  return { width: W, height: H, mirrors, run, cellBytes: (N + 7) >> 3 };
}

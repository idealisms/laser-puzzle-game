'use strict';
/**
 * simulator2.ts — Segment-based beam search with splitter support.
 *
 * Instead of tracking the laser path as a list of individual cells, we track
 * it as a list of axis-aligned segments. This enables a "frontier" pruning
 * strategy: when placing mirror k, we only try positions on the frontier
 * (segments created by mirror k-1, plus any unexplored branches from splitters).
 *
 * Splitter support:
 *   When the beam hits a splitter that triggers a split, two perpendicular
 *   sub-beams are spawned. Each becomes its own "frontier group". The next
 *   mirror can be placed on any frontier group, but only on cells that do not
 *   appear in any other frontier group or any retained segment.
 *
 * Key differences from the original beamSearchForDepth in simulator.ts:
 *   - traceAll() handles splits: returns Seg[][] (one group per beam branch).
 *   - BeamState uses retainedSegs + frontierGroups instead of segs + newSegs.
 *   - applyMirror takes a group index (gi) targeting one frontier group.
 *   - Candidate generation iterates all frontier groups; skips cells that
 *     appear on retained segs OR on other (non-targeted) frontier groups.
 *
 * Scoring matches calculateLaserPath: each step to a new cell is +1,
 * summed across all streams (branches).
 */

const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
const DELTAS: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const OPPOSITE = [DOWN, LEFT, UP, RIGHT];
const REFLECT: Record<string, number[]> = {
  '/':  [RIGHT, UP,   LEFT,  DOWN],
  '\\': [LEFT,  DOWN, RIGHT, UP  ],
};
const DIR_TO_INT: Record<string, number> = { up: UP, right: RIGHT, down: DOWN, left: LEFT };

function posKey(x: number, y: number): number { return x * 100 + y; }
function stateKey(x: number, y: number, dir: number): number { return (x * 20 + y) * 4 + dir; }

// ── Segment ───────────────────────────────────────────────────────────────────
// A laser beam traveling from (x1,y1) in direction `dir` for `len` steps.
// Cell at step k (0 ≤ k ≤ len): (x1 + k*dx, y1 + k*dy) at global time (t1+k).
// Step 0 = start cell; step len = terminal cell (may be off-grid for edge exits).
interface Seg {
  x1: number; y1: number;
  x2: number; y2: number;
  dir: number;
  t1: number;   // global time at (x1, y1)
  len: number;  // number of steps from start to terminal
}

// Returns step index k ∈ [0, s.len] if (px,py) is on segment s, else -1.
function segContains(s: Seg, px: number, py: number): number {
  const [dx, dy] = DELTAS[s.dir];
  if (dx !== 0) {
    if (py !== s.y1) return -1;
    const k = dx > 0 ? px - s.x1 : s.x1 - px;
    return (k >= 0 && k <= s.len) ? k : -1;
  } else {
    if (px !== s.x1) return -1;
    const k = dy > 0 ? py - s.y1 : s.y1 - py;
    return (k >= 0 && k <= s.len) ? k : -1;
  }
}

// Build a Set of stateKey(x,y,dir) for every cell of the given segments.
// Used to seed loop-detection across retained and other-frontier segments.
function buildVisited(segs: Seg[]): Set<number> {
  const v = new Set<number>();
  for (const s of segs) {
    const [dx, dy] = DELTAS[s.dir];
    for (let k = 0; k <= s.len; k++) {
      v.add(stateKey(s.x1 + k * dx, s.y1 + k * dy, s.dir));
    }
  }
  return v;
}

// ── Single-stream tracer ──────────────────────────────────────────────────────
/**
 * Trace one beam stream from (sx,sy) going startDir.
 *
 * `visited` is shared across all concurrent streams in one traceAll() call.
 * Returns the segments for this stream plus any pending split-starts.
 *
 * Terminates when the beam:
 *   - exits the grid (edge)
 *   - hits a wall obstacle
 *   - hits a gate from the wrong direction
 *   - hits a splitter that acts as a wall (opposite of orientation)
 *   - hits a splitter that causes a split (returns splits instead of continuing)
 *   - revisits a (x,y,dir) state already in visited (loop)
 *
 * Splitter reflect: beam is perpendicular to orientation → continues in
 *   OPPOSITE[splitterOrientation] direction (no split, no wall).
 */
function traceOne(
  sx: number, sy: number, startDir: number, startTime: number,
  width: number, height: number,
  mirrorMap: Map<number, string>,
  obstacleSet: Set<number>,
  gateMap: Map<number, number>,
  splitterMap: Map<number, string>,
  visited: Set<number>,
): { segs: Seg[]; splits: Array<{ x: number; y: number; dir: number; t: number }> } {
  const result: Seg[] = [];

  // Immediate loop check at starting cell
  if (visited.has(stateKey(sx, sy, startDir))) return { segs: result, splits: [] };
  visited.add(stateKey(sx, sy, startDir));

  let x = sx, y = sy, dir = startDir;
  let segX = sx, segY = sy, segT = startTime, stepsInSeg = 0;

  const MAX_TOTAL = 2000;
  let total = 0;

  while (total < MAX_TOTAL) {
    const [dx, dy] = DELTAS[dir];
    const nx = x + dx, ny = y + dy;
    stepsInSeg++;
    total++;

    // Off grid → terminate
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      return { segs: result, splits: [] };
    }

    const pk = posKey(nx, ny);

    // Wall obstacle
    if (obstacleSet.has(pk)) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      return { segs: result, splits: [] };
    }

    // Gate: pass if direction matches, wall otherwise
    const gateDir = gateMap.get(pk);
    if (gateDir !== undefined) {
      if (dir !== gateDir) {
        result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
        return { segs: result, splits: [] };
      }
      // Pass through: fall through to loop check below
    }

    // Splitter
    const splOrientation = splitterMap.get(pk);
    if (splOrientation !== undefined) {
      const splDir = DIR_TO_INT[splOrientation];
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      const t = segT + stepsInSeg;
      if (dir === splDir) {
        // Split: two perpendicular beams
        const perp1 = (dir === LEFT || dir === RIGHT) ? UP : LEFT;
        const perp2 = (dir === LEFT || dir === RIGHT) ? DOWN : RIGHT;
        return {
          segs: result,
          splits: [
            { x: nx, y: ny, dir: perp1, t },
            { x: nx, y: ny, dir: perp2, t },
          ],
        };
      } else if (dir === OPPOSITE[splDir]) {
        // Wall: blocked
        return { segs: result, splits: [] };
      } else {
        // Reflect toward OPPOSITE[splDir]
        const newDir = OPPOSITE[splDir];
        x = nx; y = ny; dir = newDir;
        segX = nx; segY = ny; segT = t; stepsInSeg = 0;
        const sk = stateKey(x, y, dir);
        if (visited.has(sk)) return { segs: result, splits: [] };
        visited.add(sk);
        continue;
      }
    }

    // Mirror: close current segment, reflect, start new segment
    const mtype = mirrorMap.get(pk);
    if (mtype !== undefined) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      const newDir = REFLECT[mtype][dir];
      x = nx; y = ny; dir = newDir;
      segX = nx; segY = ny; segT = segT + stepsInSeg; stepsInSeg = 0;
      const sk = stateKey(x, y, dir);
      if (visited.has(sk)) return { segs: result, splits: [] };
      visited.add(sk);
      continue;
    }

    // Loop check at (nx, ny, dir)
    const sk = stateKey(nx, ny, dir);
    if (visited.has(sk)) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      return { segs: result, splits: [] };
    }
    visited.add(sk);
    x = nx; y = ny;
  }

  // MAX_TOTAL exceeded
  result.push({ x1: segX, y1: segY, x2: x, y2: y, dir, t1: segT, len: stepsInSeg });
  return { segs: result, splits: [] };
}

// ── Full trace (handles splits) ────────────────────────────────────────────────
/**
 * Trace a beam and all its sub-beams (from splitter splits).
 * Returns one Seg[] per beam branch (stream). The visited set is shared
 * across all branches so loop detection works correctly.
 *
 * `existingSegs` seeds the initial visited set (retained path + other
 * frontier groups) so new beams don't silently loop back into them.
 */
function traceAll(
  sx: number, sy: number, startDir: number, startTime: number,
  width: number, height: number,
  mirrorMap: Map<number, string>,
  obstacleSet: Set<number>,
  gateMap: Map<number, number>,
  splitterMap: Map<number, string>,
  existingSegs: Seg[],
): Seg[][] {
  const result: Seg[][] = [];
  const visited = buildVisited(existingSegs);
  const pending: Array<{ x: number; y: number; dir: number; t: number }> = [
    { x: sx, y: sy, dir: startDir, t: startTime },
  ];

  while (pending.length > 0) {
    const { x, y, dir, t } = pending.shift()!;
    const { segs, splits } = traceOne(
      x, y, dir, t, width, height,
      mirrorMap, obstacleSet, gateMap, splitterMap, visited,
    );
    if (segs.length > 0) result.push(segs);
    for (const sp of splits) pending.push(sp);
  }

  return result;
}

// ── Beam state ────────────────────────────────────────────────────────────────
interface BeamState {
  mirrors: Array<[number, number, string]>;
  mirrorMap: Map<number, string>;
  retainedSegs: Seg[];      // finalized segments from consumed/trimmed branches
  frontierGroups: Seg[][];  // active branches: each is a list of segments
  score: number;            // sum of all seg.len across retained + all frontier groups
}

// ── Apply a mirror ────────────────────────────────────────────────────────────
/**
 * Place a mirror of type `mtype` at (px,py), which must lie on a non-terminal
 * cell of frontier group `gi`. Returns the new BeamState, or null if the
 * position is not valid for that group.
 *
 * The new state's frontierGroups = (other groups unchanged) + (new groups from
 * tracing the reflected beam, which may include splitter sub-beams).
 */
function applyMirror(
  state: BeamState,
  gi: number,
  px: number, py: number, mtype: string,
  obstacleSet: Set<number>,
  gateMap: Map<number, number>,
  splitterMap: Map<number, string>,
  width: number, height: number,
): BeamState | null {
  const group = state.frontierGroups[gi];

  // Find which segment in group gi contains (px,py), excluding terminal cell
  let hitSeg: Seg | null = null;
  let hitK = -1;
  let hitSegIdx = -1;
  for (let si = 0; si < group.length; si++) {
    const s = group[si];
    const k = segContains(s, px, py);
    if (k >= 0 && k < s.len) { hitSeg = s; hitK = k; hitSegIdx = si; break; }
  }
  if (!hitSeg) return null;

  const tMirror = hitSeg.t1 + hitK;
  const newDir = REFLECT[mtype][hitSeg.dir];

  // Score delta: subtract old group contribution, add pre-hit + new groups
  const oldGroupScore = group.reduce((s, seg) => s + seg.len, 0);
  let preHitScore = hitK;
  for (let si = 0; si < hitSegIdx; si++) preHitScore += group[si].len;

  // Build new retained segs: existing retained + segments from group gi before hitSeg
  const newRetained = [...state.retainedSegs];
  for (let si = 0; si < hitSegIdx; si++) newRetained.push(group[si]);
  if (hitK > 0) {
    newRetained.push({
      x1: hitSeg.x1, y1: hitSeg.y1,
      x2: px, y2: py,
      dir: hitSeg.dir, t1: hitSeg.t1,
      len: hitK,
    });
  }

  // New mirror map
  const newMirrorMap = new Map(state.mirrorMap);
  newMirrorMap.set(posKey(px, py), mtype);

  // Build existingSegs for loop detection: retained + other frontier groups
  const otherGroups = state.frontierGroups.filter((_, j) => j !== gi);
  const allExisting: Seg[] = [...newRetained];
  for (const g of otherGroups) for (const s of g) allExisting.push(s);

  // Trace the new reflected beam (may produce multiple groups via splitters)
  const newGroups = traceAll(
    px, py, newDir, tMirror,
    width, height, newMirrorMap, obstacleSet, gateMap, splitterMap, allExisting,
  );
  const newGroupScore = newGroups.reduce((s, g) => s + g.reduce((ss, seg) => ss + seg.len, 0), 0);

  return {
    mirrors: [...state.mirrors, [px, py, mtype]],
    mirrorMap: newMirrorMap,
    retainedSegs: newRetained,
    frontierGroups: [...otherGroups, ...newGroups],
    score: state.score - oldGroupScore + preHitScore + newGroupScore,
  };
}

// ── Min-heap (keyed on .score) ────────────────────────────────────────────────
class MinHeap {
  _data: BeamState[];
  constructor() { this._data = []; }
  get size() { return this._data.length; }
  peek() { return this._data[0]; }
  push(item: BeamState) {
    this._data.push(item);
    this._siftUp(this._data.length - 1);
  }
  replaceMin(item: BeamState) {
    this._data[0] = item;
    this._siftDown(0);
  }
  _siftUp(i: number) {
    const d = this._data;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p].score <= d[i].score) break;
      [d[p], d[i]] = [d[i], d[p]]; i = p;
    }
  }
  _siftDown(i: number) {
    const d = this._data, n = d.length;
    for (;;) {
      let s = i, l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && d[l].score < d[s].score) s = l;
      if (r < n && d[r].score < d[s].score) s = r;
      if (s === i) break;
      [d[s], d[i]] = [d[i], d[s]]; i = s;
    }
  }
  toArray() { return this._data; }
}

// ── Segment-based beam search ─────────────────────────────────────────────────
/**
 * Drop-in replacement for beamSearchForDepth from simulator.ts.
 *
 * Handles both plain mirror puzzles and splitter/gate puzzles natively.
 * For splitter puzzles, multiple frontier groups are maintained — one per
 * active beam branch. Mirror placements target one frontier group at a time;
 * cells shared with other groups or retained segments are skipped.
 *
 * @param config      Puzzle configuration (same format as beamSearchForDepth).
 * @param targetDepth Number of mirrors to place.
 * @param opts        { beamWidth, obstacleSet, splitterMap, gateMap, invalidPositions }
 */
function beamSearchForDepth2(config: any, targetDepth: number, opts: any): { score: number; mirrors: any[] } {
  const {
    beamWidth = 12000,
    obstacleSet,
    splitterMap,
    gateMap,
    invalidPositions,
  } = opts;

  // Resolve gateMap: worker.ts provides integer values; if called directly,
  // reconstruct from config (string directions → integers).
  const resolvedGateMap: Map<number, number> = gateMap ?? new Map(
    (config.gates || []).map(([x, y, o]: [number, number, string]) =>
      [posKey(x, y), DIR_TO_INT[o]]
    )
  );

  // Resolve splitterMap: worker.ts provides Map<posKey, orientationString>.
  const resolvedSplitterMap: Map<number, string> = splitterMap ?? new Map(
    (config.splitters || []).map(([x, y, o]: [number, number, string]) =>
      [posKey(x, y), o]
    )
  );

  // Initial trace (no mirrors) — may return multiple groups for splitter puzzles
  const initGroups = traceAll(
    config.laserX, config.laserY, config.laserDir, 0,
    config.width, config.height,
    new Map(), obstacleSet, resolvedGateMap, resolvedSplitterMap, [],
  );
  const initScore = initGroups.reduce(
    (s: number, g: Seg[]) => s + g.reduce((ss: number, seg: Seg) => ss + seg.len, 0), 0
  );

  let bestScore = initScore, bestMirrors: any[] = [];

  let candidates: BeamState[] = [{
    mirrors: [],
    mirrorMap: new Map(),
    retainedSegs: [],
    frontierGroups: initGroups,
    score: initScore,
  }];

  for (let depth = 0; depth < targetDepth; depth++) {
    const heap = new MinHeap();

    for (const cand of candidates) {
      for (let gi = 0; gi < cand.frontierGroups.length; gi++) {
        const group = cand.frontierGroups[gi];

        for (const seg of group) {
          const [dx, dy] = DELTAS[seg.dir];
          // Enumerate candidate cells: k=0..len-1 (exclude terminal cell at k=len).
          for (let k = 0; k < seg.len; k++) {
            const cx = seg.x1 + k * dx;
            const cy = seg.y1 + k * dy;
            const pk = posKey(cx, cy);
            if (invalidPositions.has(pk)) continue;
            if (cand.mirrorMap.has(pk)) continue;

            // Skip cells on retained segments (placing there corrupts retained score).
            let occupied = false;
            for (const s of cand.retainedSegs) {
              if (segContains(s, cx, cy) >= 0) { occupied = true; break; }
            }
            if (occupied) continue;

            // Skip cells on other frontier groups (placing there would change their
            // contribution without updating the score for those groups).
            for (let gj = 0; gj < cand.frontierGroups.length && !occupied; gj++) {
              if (gj === gi) continue;
              for (const s of cand.frontierGroups[gj]) {
                if (segContains(s, cx, cy) >= 0) { occupied = true; break; }
              }
            }
            if (occupied) continue;

            for (const mtype of ['/', '\\']) {
              const ns = applyMirror(
                cand, gi, cx, cy, mtype,
                obstacleSet, resolvedGateMap, resolvedSplitterMap,
                config.width, config.height,
              );
              if (!ns) continue;

              if (ns.score > bestScore) { bestScore = ns.score; bestMirrors = ns.mirrors; }

              if (heap.size < beamWidth) {
                heap.push(ns);
              } else if (ns.score > heap.peek().score) {
                heap.replaceMin(ns);
              }
            }
          }
        }
      }
    }

    candidates = heap.toArray();
    if (candidates.length === 0) break;
  }

  return { score: bestScore, mirrors: bestMirrors };
}

module.exports = { beamSearchForDepth2 };

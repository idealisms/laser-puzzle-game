'use strict';
/**
 * simulator2.ts — Segment-based beam search.
 *
 * Instead of tracking the laser path as a list of individual cells, we track
 * it as a list of axis-aligned segments. This enables a "frontier" pruning
 * strategy: when placing mirror k, we only try positions on the segments that
 * mirror k-1 created (the "new segments"). Positions on older segments were
 * already explored in the parent state.
 *
 * Key differences from the original beamSearchForDepth in simulator.ts:
 *   - Candidate positions come from `newSegs` only (the frontier), not the
 *     full path. This is O(new_seg_length) instead of O(full_path_length).
 *   - `applyMirror` retains and trims segments analytically rather than
 *     re-stepping the entire retained path.
 *   - Loop detection uses a (x,y,dir) visited-state set built from retained
 *     segments, checked in O(1) per step during tracing.
 *
 * Splitter puzzles fall back to beamSearchForDepth (correct but slower).
 * Gate puzzles without splitters use the new approach.
 *
 * Scoring is identical to calculateLaserPath / simulateLaser: each step to a
 * new cell increments the score by 1, including the terminal cell (whether
 * that's a wall, obstacle, or loop-back cell).
 */

const { beamSearchForDepth } = require('./simulator');

const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
const DELTAS: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
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
// Used to detect loops back into the existing path during new-beam tracing.
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

// ── Beam tracing ──────────────────────────────────────────────────────────────
/**
 * Trace a laser beam from (sx,sy) going `startDir` at global time `startTime`.
 *
 * Returns an array of Seg objects. Terminates when the beam:
 *   - exits the grid (edge)
 *   - hits a wall obstacle
 *   - hits a gate from the wrong direction
 *   - revisits a (x,y,dir) state already in the visited set (loop)
 *
 * `existingSegs` are the segments retained from before this new beam.
 * They seed the initial visited set so the new beam won't loop back into the
 * existing path without detection.
 *
 * `mirrorMap` must contain ALL placed mirrors (existing + newly placed).
 */
function traceBeam(
  sx: number, sy: number, startDir: number, startTime: number,
  width: number, height: number,
  mirrorMap: Map<number, string>,
  obstacleSet: Set<number>,
  gateMap: Map<number, number>,
  existingSegs: Seg[],
): Seg[] {
  const result: Seg[] = [];
  const visited = buildVisited(existingSegs);

  let x = sx, y = sy, dir = startDir;
  let segX = sx, segY = sy, segT = startTime, stepsInSeg = 0;

  // Immediate loop check at starting cell
  if (visited.has(stateKey(x, y, dir))) return result;
  visited.add(stateKey(x, y, dir));

  const MAX_TOTAL = 2000;
  let total = 0;

  while (total < MAX_TOTAL) {
    const [dx, dy] = DELTAS[dir];
    const nx = x + dx, ny = y + dy;
    stepsInSeg++;
    total++;

    // Off grid → terminate (terminal cell is off-grid)
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      return result;
    }

    const pk = posKey(nx, ny);

    // Wall obstacle
    if (obstacleSet.has(pk)) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      return result;
    }

    // Gate: only passes in its orientation direction
    const gateDir = gateMap.get(pk);
    if (gateDir !== undefined && dir !== gateDir) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      return result;
    }

    // Mirror: close current segment, reflect, start new segment
    const mtype = mirrorMap.get(pk);
    if (mtype !== undefined) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      const newDir = REFLECT[mtype][dir];
      x = nx; y = ny; dir = newDir;
      segX = nx; segY = ny; segT = segT + stepsInSeg; stepsInSeg = 0;
      const sk = stateKey(x, y, dir);
      if (visited.has(sk)) return result;
      visited.add(sk);
      continue;
    }

    // Loop check at (nx, ny) going dir
    const sk = stateKey(nx, ny, dir);
    if (visited.has(sk)) {
      result.push({ x1: segX, y1: segY, x2: nx, y2: ny, dir, t1: segT, len: stepsInSeg });
      return result;
    }
    visited.add(sk);
    x = nx; y = ny;
  }

  // MAX_TOTAL exceeded
  result.push({ x1: segX, y1: segY, x2: x, y2: y, dir, t1: segT, len: stepsInSeg });
  return result;
}

// ── Beam state ────────────────────────────────────────────────────────────────
interface BeamState {
  mirrors: Array<[number, number, string]>;
  mirrorMap: Map<number, string>;
  segs: Seg[];      // full retained path (all segments)
  newSegs: Seg[];   // frontier: segments to try mirror placements on
  score: number;    // sum of seg.len for all segs
}

// ── Apply a mirror ────────────────────────────────────────────────────────────
/**
 * Place a mirror of type `mtype` at (px,py), which must lie on one of
 * state.newSegs (at a non-terminal step). Returns the new BeamState, or null
 * if (px,py) is not a valid placement.
 *
 * The new state's `newSegs` is exactly the segments produced by tracing the
 * reflected beam — the frontier for the next mirror placement.
 */
function applyMirror(
  state: BeamState,
  px: number, py: number, mtype: string,
  obstacleSet: Set<number>,
  gateMap: Map<number, number>,
  width: number, height: number,
): BeamState | null {
  // Find which newSeg contains (px,py), excluding the terminal cell (k = seg.len)
  let hitSeg: Seg | null = null;
  let hitK = -1;
  for (const s of state.newSegs) {
    const k = segContains(s, px, py);
    if (k >= 0 && k < s.len) { hitSeg = s; hitK = k; break; }
  }
  if (!hitSeg) return null;

  const tMirror = hitSeg.t1 + hitK;
  const newDir = REFLECT[mtype][hitSeg.dir];

  // Retain all segments strictly before hitSeg (by start time)
  const retainedSegs: Seg[] = [];
  let score = 0;
  for (const s of state.segs) {
    if (s.t1 < hitSeg.t1) { retainedSegs.push(s); score += s.len; }
  }

  // Add trimmed hitSeg: from its start to (px,py), length = hitK
  // (if hitK === 0 the mirror is at the segment's origin — already in mirrorMap
  //  or invalidPositions, so this branch is filtered by the caller)
  if (hitK > 0) {
    retainedSegs.push({
      x1: hitSeg.x1, y1: hitSeg.y1,
      x2: px, y2: py,
      dir: hitSeg.dir, t1: hitSeg.t1,
      len: hitK,
    });
    score += hitK;
  }

  // Add the new mirror to the map
  const newMirrorMap = new Map(state.mirrorMap);
  newMirrorMap.set(posKey(px, py), mtype);

  // Trace the reflected beam
  const newSegs = traceBeam(
    px, py, newDir, tMirror,
    width, height, newMirrorMap, obstacleSet, gateMap, retainedSegs,
  );
  for (const s of newSegs) score += s.len;

  return {
    mirrors: [...state.mirrors, [px, py, mtype]],
    mirrorMap: newMirrorMap,
    segs: [...retainedSegs, ...newSegs],
    newSegs,
    score,
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
 * Uses frontier-based candidate generation: at each depth, only positions on
 * `newSegs` (the segments created by the previous mirror) are explored. This
 * is typically far fewer candidates than the full-path approach, at the cost
 * of not revisiting earlier path segments at deeper levels.
 *
 * Splitter puzzles fall back to the original beamSearchForDepth automatically.
 *
 * @param config      Puzzle configuration (same format as beamSearchForDepth).
 * @param targetDepth Number of mirrors to place.
 * @param opts        { beamWidth, obstacleSet, splitterMap, gateMap,
 *                      invalidPositions, [fallback fields for splitter path] }
 */
function beamSearchForDepth2(config: any, targetDepth: number, opts: any): { score: number; mirrors: any[] } {
  const {
    beamWidth = 12000,
    obstacleSet,
    splitterMap,
    gateMap,
    invalidPositions,
  } = opts;

  // Splitter puzzles: fall back to original full-simulation beam search
  if (splitterMap && splitterMap.size > 0) {
    return beamSearchForDepth(config, targetDepth, opts);
  }

  // Resolve gateMap: worker.ts provides integer values; if called directly,
  // reconstruct from config (string directions → integers).
  const resolvedGateMap: Map<number, number> = gateMap ?? new Map(
    (config.gates || []).map(([x, y, o]: [number, number, string]) =>
      [posKey(x, y), DIR_TO_INT[o]]
    )
  );

  // Initial trace (no mirrors)
  const initSegs = traceBeam(
    config.laserX, config.laserY, config.laserDir, 0,
    config.width, config.height,
    new Map(), obstacleSet, resolvedGateMap, [],
  );
  const initScore = initSegs.reduce((s: number, seg: Seg) => s + seg.len, 0);

  let bestScore = initScore, bestMirrors: any[] = [];

  let candidates: BeamState[] = [{
    mirrors: [],
    mirrorMap: new Map(),
    segs: initSegs,
    newSegs: initSegs,
    score: initScore,
  }];

  for (let depth = 0; depth < targetDepth; depth++) {
    const heap = new MinHeap();

    for (const cand of candidates) {
      // Identify frontier segments so we can skip them in the retained-cell check.
      const frontierSet = new Set(cand.newSegs);

      for (const seg of cand.newSegs) {
        const [dx, dy] = DELTAS[seg.dir];
        // Enumerate candidate cells: k=0..len-1 (exclude terminal cell at k=len).
        // k=0 is always the mirror/source cell, filtered by mirrorMap/invalidPositions.
        for (let k = 0; k < seg.len; k++) {
          const cx = seg.x1 + k * dx;
          const cy = seg.y1 + k * dy;
          const pk = posKey(cx, cy);
          if (invalidPositions.has(pk)) continue;
          if (cand.mirrorMap.has(pk)) continue;

          // Skip cells that also lie on a retained (non-frontier) segment: placing a
          // mirror there would invalidate the retained path, corrupting the score.
          let onRetained = false;
          for (const s of cand.segs) {
            if (frontierSet.has(s)) continue;
            if (segContains(s, cx, cy) >= 0) { onRetained = true; break; }
          }
          if (onRetained) continue;

          for (const mtype of ['/', '\\']) {
            const ns = applyMirror(cand, cx, cy, mtype, obstacleSet, resolvedGateMap, config.width, config.height);
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

    candidates = heap.toArray();
    if (candidates.length === 0) break;
  }

  return { score: bestScore, mirrors: bestMirrors };
}

module.exports = { beamSearchForDepth2 };

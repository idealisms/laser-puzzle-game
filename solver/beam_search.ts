'use strict';
/**
 * beam_search.ts — Layer-parallel beam search over mirror placements.
 *
 * Works for every puzzle type (splitters, gates, plain walls); scoring is done
 * by fastsim.ts, which matches calculateLaserPath exactly.
 *
 * The main thread holds the beam. For each depth it hands out chunks of the
 * beam to a pool of worker threads (beam_worker.ts). Each worker expands its
 * chunks into a local top-`beamWidth` heap, then the main thread merges the
 * workers' heaps into the next beam.
 *
 * Beam entries are just their mirror lists: each mirror is packed into a
 * Uint16 as (x*height + y)*2 + (type === '\\' ? 1 : 0). The cells a beam
 * visits are recomputed when the entry is expanded, which costs one
 * simulation against the hundreds spent trying placements.
 *
 * Mirror sets reached in different orders are deduplicated using a Zobrist
 * hash. Entries are ranked by (score, hash), a total order, so each worker's
 * local top-K contains every global top-K entry from its chunks and the merged
 * beam is identical no matter how many workers run.
 */

const { createFastSim } = require('./fastsim');

// ── Mirror encoding ──────────────────────────────────────────────────────────

function encodeMirror(height: number, x: number, y: number, type: string): number {
  return (x * height + y) * 2 + (type === '/' ? 0 : 1);
}

function decodeMirror(height: number, m: number): [number, number, string] {
  const c = m >> 1;
  return [Math.floor(c / height), c % height, (m & 1) ? '\\' : '/'];
}

// ── Zobrist hashing ──────────────────────────────────────────────────────────
// A mirror set's hash is the XOR of one random value per (cell, type). Kept as
// two 32-bit halves combined into a 53-bit float so it can be compared and
// stored in a Set without BigInt.

function makeZobrist(numCells: number) {
  let seed = 0x9E3779B9;
  const next = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return seed >>> 0;
  };
  const hi = new Uint32Array(numCells * 2), lo = new Uint32Array(numCells * 2);
  for (let i = 0; i < hi.length; i++) { hi[i] = next() & 0x1FFFFF; lo[i] = next(); }
  return { hi, lo };
}

function combineHash(hi: number, lo: number): number {
  return hi * 4294967296 + (lo >>> 0);
}

// ── Expansion (runs inside workers) ──────────────────────────────────────────

/**
 * Keeps the top `capacity` entries by (score, hash), ignoring duplicate hashes.
 * Entries live in fixed slots; the heap orders slot indices (min at the root).
 */
class TopK {
  capacity: number; depth: number;
  size = 0;
  scores: Int32Array; hashes: Float64Array; mirrors: Uint16Array;
  heap: Int32Array;
  present = new Set<number>();

  constructor(capacity: number, depth: number) {
    this.capacity = capacity; this.depth = depth;
    this.scores = new Int32Array(capacity);
    this.hashes = new Float64Array(capacity);
    this.mirrors = new Uint16Array(capacity * depth);
    this.heap = new Int32Array(capacity);
  }

  _less(a: number, b: number): boolean {
    const sa = this.scores[a], sb = this.scores[b];
    return sa < sb || (sa === sb && this.hashes[a] < this.hashes[b]);
  }

  /** Would an entry with this score and hash be admitted? */
  wants(score: number, hash: number): boolean {
    if (this.present.has(hash)) return false;
    if (this.size < this.capacity) return true;
    const m = this.heap[0];
    const ms = this.scores[m];
    return score > ms || (score === ms && hash > this.hashes[m]);
  }

  /** Insert (caller must have checked wants()). Returns the slot to fill with mirrors. */
  insert(score: number, hash: number): number {
    let slot: number;
    if (this.size < this.capacity) {
      slot = this.size;
      this.heap[this.size++] = slot;
      this.scores[slot] = score; this.hashes[slot] = hash;
      this._siftUp(this.size - 1);
    } else {
      slot = this.heap[0];
      this.present.delete(this.hashes[slot]);
      this.scores[slot] = score; this.hashes[slot] = hash;
      this._siftDown(0);
    }
    this.present.add(hash);
    return slot;
  }

  _siftUp(i: number) {
    const h = this.heap;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this._less(h[i], h[p])) break;
      const t = h[p]; h[p] = h[i]; h[i] = t;
      i = p;
    }
  }

  _siftDown(i: number) {
    const h = this.heap, n = this.size;
    for (;;) {
      let s = i;
      const l = 2 * i + 1, r = l + 1;
      if (l < n && this._less(h[l], h[s])) s = l;
      if (r < n && this._less(h[r], h[s])) s = r;
      if (s === i) break;
      const t = h[s]; h[s] = h[i]; h[i] = t;
      i = s;
    }
  }

  /** Compact result for transfer to the main thread. */
  export() {
    const n = this.size, d = this.depth;
    return {
      scores: this.scores.slice(0, n),
      hashes: this.hashes.slice(0, n),
      mirrors: this.mirrors.slice(0, n * d),
    };
  }
}

/**
 * Creates an expander bound to one puzzle. Used by beam_worker.ts; exposed
 * for single-threaded use and tests.
 */
function createExpander(config: any, opts: { usePathPruning?: boolean } = {}) {
  const { usePathPruning = true } = opts;
  const W: number = config.width, H: number = config.height, N = W * H;
  const sim = createFastSim(config);
  const zob = makeZobrist(N);

  const invalid = new Uint8Array(N);
  for (const [x, y] of config.obstacles) invalid[x * H + y] = 1;
  for (const [x, y] of config.splitters || []) invalid[x * H + y] = 1;
  for (const [x, y] of config.gates || []) invalid[x * H + y] = 1;
  invalid[config.laserX * H + config.laserY] = 1;

  const cells = new Uint8Array(sim.cellBytes);
  let top: TopK | null = null;

  return {
    /** Start a new layer whose children have `childDepth` mirrors. */
    begin(childDepth: number, beamWidth: number) {
      top = new TopK(beamWidth, childDepth);
    },

    /** Expand `count` parents, each `parentDepth` packed mirrors, into the layer's heap. */
    expand(parents: Uint16Array, parentDepth: number) {
      const t = top!;
      const grid = sim.mirrors;
      const count = parentDepth === 0 ? 1 : parents.length / parentDepth;
      for (let p = 0; p < count; p++) {
        const base = p * parentDepth;
        let hHi = 0, hLo = 0;
        for (let i = 0; i < parentDepth; i++) {
          const m = parents[base + i];
          grid[m >> 1] = (m & 1) + 1;
          hHi ^= zob.hi[m]; hLo ^= zob.lo[m];
        }

        if (usePathPruning) sim.run(cells);
        for (let c = 0; c < N; c++) {
          if (invalid[c] || grid[c]) continue;
          if (usePathPruning && !((cells[c >> 3] >> (c & 7)) & 1)) continue;
          for (let type = 0; type < 2; type++) {
            const m = c * 2 + type;
            grid[c] = type + 1;
            const score = sim.run(null);
            grid[c] = 0;
            const hash = combineHash(hHi ^ zob.hi[m], hLo ^ zob.lo[m]);
            if (!t.wants(score, hash)) continue;
            const slot = t.insert(score, hash);
            const out = slot * (parentDepth + 1);
            t.mirrors.set(parents.subarray(base, base + parentDepth), out);
            t.mirrors[out + parentDepth] = m;
          }
        }

        for (let i = 0; i < parentDepth; i++) grid[parents[base + i] >> 1] = 0;
      }
    },

    /** Finish the layer and return its top entries. */
    end() {
      const result = top!.export();
      top = null;
      return result;
    },
  };
}

// ── Merging (main thread) ────────────────────────────────────────────────────

interface LayerResult { scores: Int32Array; hashes: Float64Array; mirrors: Uint16Array; }

/** Merge per-worker top-K lists into the global top-K, best first. */
function mergeLayer(results: LayerResult[], depth: number, beamWidth: number) {
  const refs: [number, number][] = []; // [result index, entry index]
  for (let r = 0; r < results.length; r++)
    for (let i = 0; i < results[r].scores.length; i++) refs.push([r, i]);
  refs.sort((a, b) => {
    const ra = results[a[0]], rb = results[b[0]];
    return (rb.scores[b[1]] - ra.scores[a[1]]) || (rb.hashes[b[1]] - ra.hashes[a[1]]);
  });

  const seen = new Set<number>();
  const scores: number[] = [];
  const mirrors = new Uint16Array(Math.min(refs.length, beamWidth) * depth);
  for (const [r, i] of refs) {
    if (scores.length >= beamWidth) break;
    const res = results[r];
    const h = res.hashes[i];
    if (seen.has(h)) continue;
    seen.add(h);
    mirrors.set(res.mirrors.subarray(i * depth, (i + 1) * depth), scores.length * depth);
    scores.push(res.scores[i]);
  }
  return { scores, mirrors: mirrors.subarray(0, scores.length * depth) };
}

// ── Driver ───────────────────────────────────────────────────────────────────

interface Pool {
  size: number;
  /** Send a message to worker i and resolve with its reply. */
  request(i: number, msg: any, transfer?: ArrayBuffer[]): Promise<any>;
}

const CHUNK_SIZE = 32; // parents per chunk handed to a worker

/**
 * Beam search up to config.numMirrors mirrors, returning the best placement
 * seen at any depth.
 */
async function beamSearch(config: any, pool: Pool, opts: { beamWidth: number; onLayer?: (info: any) => void }) {
  const { beamWidth, onLayer } = opts;
  const H: number = config.height;

  const initialSim = createFastSim(config);
  let bestScore = initialSim.run(null);
  let bestMirrors = new Uint16Array(0);

  let beam = new Uint16Array(0); // flat parents, `depth` mirrors each
  let beamCount = 1;             // the empty placement

  for (let depth = 0; depth < config.numMirrors && beamCount > 0; depth++) {
    const layerStart = Date.now();
    await Promise.all(Array.from({ length: pool.size }, (_, w) =>
      pool.request(w, { type: 'begin', childDepth: depth + 1, beamWidth })));

    let next = 0;
    const runWorker = async (w: number) => {
      while (next < beamCount) {
        const start = next;
        next = Math.min(beamCount, next + CHUNK_SIZE);
        const chunk = beam.slice(start * depth, next * depth);
        await pool.request(w, { type: 'expand', parents: chunk, parentDepth: depth }, [chunk.buffer]);
      }
      return pool.request(w, { type: 'end' });
    };
    const results: LayerResult[] = await Promise.all(
      Array.from({ length: pool.size }, (_, w) => runWorker(w)));

    const merged = mergeLayer(results, depth + 1, beamWidth);
    beam = merged.mirrors;
    beamCount = merged.scores.length;
    if (beamCount > 0 && merged.scores[0] > bestScore) {
      bestScore = merged.scores[0];
      bestMirrors = beam.slice(0, depth + 1);
    }
    if (onLayer) onLayer({ depth: depth + 1, beamCount, layerBest: merged.scores[0] ?? 0, bestScore, ms: Date.now() - layerStart });
  }

  return {
    score: bestScore,
    mirrors: Array.from(bestMirrors, (m) => decodeMirror(H, m)),
  };
}

module.exports = { beamSearch, createExpander, mergeLayer, encodeMirror, decodeMirror };

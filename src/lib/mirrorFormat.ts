/**
 * Utilities for serializing and deserializing mirror lists stored in the DB.
 *
 * Compact format (current):  [[x, y, type], ...]   e.g. [[3,7,"/"],[5,2,"\\"]]
 * Verbose format (legacy):   [{x, y, type}, ...]   e.g. [{"x":3,"y":7,"type":"/"}]
 *
 * parseMirrorList accepts both so old DB rows continue to work.
 * formatMirrorList always writes compact.
 */

export interface FlatMirror {
  x: number
  y: number
  type: string
}

type CompactMirror = [number, number, string]

export function parseMirrorList(raw: (FlatMirror | CompactMirror)[]): FlatMirror[] {
  return raw.map(m =>
    Array.isArray(m)
      ? { x: m[0], y: m[1], type: m[2] }
      : m,
  )
}

export function formatMirrorList(mirrors: FlatMirror[]): string {
  return JSON.stringify(mirrors.map(m => [m.x, m.y, m.type]))
}

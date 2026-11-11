// Moves a player's localStorage from the old domain to the new one.
//
// Browser storage is per-origin, so the old host serves only a redirect page
// (src/app/moved) that packs the player's data into the URL fragment:
//   https://<new site>/<same path>#migrate=v1.<base64url JSON>
// The fragment never reaches the server or its logs. On the new host,
// importFromLocationHash() runs before React renders, merges the data into
// localStorage and strips the fragment.
//
// Anyone can craft such a link, so incoming data is validated field by field and
// merged without ever lowering a score or replacing a player ID that already has
// history. The server recomputes every submitted score, so a forged best score
// only affects the victim's own browser.

export const STORAGE_KEYS = {
  anonId: 'laser-puzzle-anon-id',
  progress: 'laser-puzzle-progress',
  settings: 'laser-puzzle-settings',
} as const

const HASH_KEY = '#migrate='
const HASH_PREFIX = `${HASH_KEY}v1.`

export interface ProgressMirror {
  position: { x: number; y: number }
  type: '/' | '\\'
}

export interface ProgressEntry {
  bestScore: number
  bestSolution?: ProgressMirror[]
  optimalScore?: number
}

export interface MigrationPayload {
  anonId?: string
  progress?: Record<string, ProgressEntry>
  settings?: Record<string, boolean>
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const SETTING_KEY_REGEX = /^[A-Za-z]{1,40}$/
const MAX_SCORE = 100_000
const MAX_MIRRORS = 50
const MAX_COORD = 100
const MAX_DAYS = 5000
const MAX_SETTINGS = 20

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

function sanitizeSolution(raw: unknown): ProgressMirror[] | undefined {
  if (!Array.isArray(raw) || raw.length > MAX_MIRRORS) return undefined
  const mirrors: ProgressMirror[] = []
  for (const m of raw) {
    if (!isObject(m) || !isObject(m.position)) return undefined
    const { x, y } = m.position
    if (!isIntInRange(x, 0, MAX_COORD) || !isIntInRange(y, 0, MAX_COORD)) return undefined
    if (m.type !== '/' && m.type !== '\\') return undefined
    mirrors.push({ position: { x, y }, type: m.type })
  }
  return mirrors
}

function sanitizeEntry(raw: unknown): ProgressEntry | undefined {
  if (!isObject(raw) || !isIntInRange(raw.bestScore, 0, MAX_SCORE)) return undefined
  const entry: ProgressEntry = { bestScore: raw.bestScore }
  // A bad solution or optimal score drops just that field; the score still counts.
  const solution = sanitizeSolution(raw.bestSolution)
  if (solution) entry.bestSolution = solution
  if (isIntInRange(raw.optimalScore, 0, MAX_SCORE)) entry.optimalScore = raw.optimalScore
  return entry
}

/** Keeps only well-formed fields; anything unexpected is dropped. */
export function sanitizePayload(raw: unknown): MigrationPayload {
  if (!isObject(raw)) return {}
  const payload: MigrationPayload = {}

  if (typeof raw.anonId === 'string' && UUID_REGEX.test(raw.anonId)) {
    payload.anonId = raw.anonId
  }

  if (isObject(raw.progress)) {
    const progress: Record<string, ProgressEntry> = {}
    for (const [date, value] of Object.entries(raw.progress).slice(0, MAX_DAYS)) {
      if (!DATE_REGEX.test(date)) continue
      const entry = sanitizeEntry(value)
      if (entry) progress[date] = entry
    }
    if (Object.keys(progress).length > 0) payload.progress = progress
  }

  if (isObject(raw.settings)) {
    const settings: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(raw.settings).slice(0, MAX_SETTINGS)) {
      if (SETTING_KEY_REGEX.test(key) && typeof value === 'boolean') settings[key] = value
    }
    if (Object.keys(settings).length > 0) payload.settings = settings
  }

  return payload
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Reads the player's data on the old host, ready to send. */
export function readPayload(storage: StorageLike): MigrationPayload {
  return sanitizePayload({
    anonId: storage.getItem(STORAGE_KEYS.anonId),
    progress: parseJson(storage.getItem(STORAGE_KEYS.progress)),
    settings: parseJson(storage.getItem(STORAGE_KEYS.settings)),
  })
}

export function isEmptyPayload(payload: MigrationPayload): boolean {
  return !payload.anonId && !payload.progress && !payload.settings
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function encodePayload(payload: MigrationPayload): string {
  return toBase64Url(JSON.stringify(payload))
}

/** Returns null when the data can't be decoded at all. */
export function decodePayload(encoded: string): MigrationPayload | null {
  try {
    return sanitizePayload(JSON.parse(fromBase64Url(encoded)))
  } catch {
    return null
  }
}

/**
 * Builds the URL on the new site for the same path, carrying the player's data
 * in the fragment (no fragment when there's nothing to carry).
 */
export function buildRedirectUrl(siteUrl: string, pathAndQuery: string, payload: MigrationPayload): string {
  const url = new URL(pathAndQuery, siteUrl)
  url.hash = isEmptyPayload(payload) ? '' : `migrate=v1.${encodePayload(payload)}`
  return url.toString()
}

export interface MergeResult {
  daysImported: number
  anonIdImported: boolean
  settingsImported: boolean
}

/**
 * Merges imported data into storage:
 * - progress: per day, keep whichever best score is higher
 * - player ID: adopt the old one unless this browser already has history here
 * - settings: adopt the old ones only if none are saved here yet
 */
export function mergeIntoStorage(storage: StorageLike, payload: MigrationPayload): MergeResult {
  const result: MergeResult = { daysImported: 0, anonIdImported: false, settingsImported: false }

  const storedProgress = parseJson(storage.getItem(STORAGE_KEYS.progress))
  const existing: Record<string, unknown> = isObject(storedProgress) ? storedProgress : {}
  const hadHistory = Object.keys(existing).length > 0

  if (payload.progress) {
    const merged = { ...existing }
    for (const [date, entry] of Object.entries(payload.progress)) {
      const current = merged[date]
      const currentScore = isObject(current) && typeof current.bestScore === 'number' ? current.bestScore : -1
      if (entry.bestScore > currentScore) {
        merged[date] = entry
        result.daysImported++
      }
    }
    if (result.daysImported > 0) {
      storage.setItem(STORAGE_KEYS.progress, JSON.stringify(merged))
    }
  }

  if (payload.anonId && !hadHistory && storage.getItem(STORAGE_KEYS.anonId) !== payload.anonId) {
    storage.setItem(STORAGE_KEYS.anonId, payload.anonId)
    result.anonIdImported = true
  }

  if (payload.settings && storage.getItem(STORAGE_KEYS.settings) === null) {
    storage.setItem(STORAGE_KEYS.settings, JSON.stringify(payload.settings))
    result.settingsImported = true
  }

  return result
}

/**
 * Runs on the new host before React renders. If the URL carries migrated data,
 * merges it into localStorage, then removes the fragment so a reload or bookmark
 * doesn't carry it around.
 */
export function importFromLocationHash(): MergeResult | null {
  if (typeof window === 'undefined' || !window.location.hash.startsWith(HASH_KEY)) return null

  let result: MergeResult | null = null
  if (window.location.hash.startsWith(HASH_PREFIX)) {
    const payload = decodePayload(window.location.hash.slice(HASH_PREFIX.length))
    if (payload) {
      try {
        result = mergeIntoStorage(window.localStorage, payload)
      } catch {
        // storage unavailable or full; nothing more we can do
      }
    }
  }

  stripMigrationHash()
  return result
}

/**
 * Removes a #migrate= fragment from the address bar. Called again after React
 * starts, because Next's router can restore the URL it saw at page load.
 */
export function stripMigrationHash() {
  if (typeof window === 'undefined' || !window.location.hash.startsWith(HASH_KEY)) return
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, '', pathname + search)
}

import {
  STORAGE_KEYS,
  buildRedirectUrl,
  decodePayload,
  encodePayload,
  mergeIntoStorage,
  readPayload,
  sanitizePayload,
} from './migration'

const ID_OLD = '11111111-1111-4111-8111-111111111111'
const ID_NEW = '22222222-2222-4222-8222-222222222222'

function makeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

const solution = [
  { position: { x: 3, y: 4 }, type: '/' as const },
  { position: { x: 5, y: 6 }, type: '\\' as const },
]

describe('sanitizePayload', () => {
  it('keeps well-formed data', () => {
    const raw = {
      anonId: ID_OLD,
      progress: { '2026-11-01': { bestScore: 42, bestSolution: solution, optimalScore: 50 } },
      settings: { colorblindMode: true },
    }
    expect(sanitizePayload(raw)).toEqual(raw)
  })

  it('drops a bad player ID, bad dates and bad scores', () => {
    expect(
      sanitizePayload({
        anonId: 'not-a-uuid',
        progress: {
          'nope': { bestScore: 1 },
          '2026-11-01': { bestScore: -1 },
          '2026-11-02': { bestScore: 1.5 },
          '2026-11-03': { bestScore: '7' },
          '2026-11-04': null,
          '2026-11-05': { bestScore: 7 },
        },
      })
    ).toEqual({ progress: { '2026-11-05': { bestScore: 7 } } })
  })

  it('drops only the bad solution or optimal score from an entry', () => {
    expect(
      sanitizePayload({
        progress: {
          '2026-11-01': { bestScore: 9, bestSolution: [{ position: { x: -1, y: 0 }, type: '/' }], optimalScore: 'x' },
          '2026-11-02': { bestScore: 9, bestSolution: [{ position: { x: 1, y: 1 }, type: '|' }] },
        },
      })
    ).toEqual({ progress: { '2026-11-01': { bestScore: 9 }, '2026-11-02': { bestScore: 9 } } })
  })

  it('keeps only boolean settings with plain names and drops extra fields', () => {
    expect(
      sanitizePayload({ settings: { colorblindMode: false, size: 3, 'bad key': true, __proto__x: true }, extra: 1 })
    ).toEqual({ settings: { colorblindMode: false } })
  })

  it('returns an empty payload for non-objects', () => {
    expect(sanitizePayload(null)).toEqual({})
    expect(sanitizePayload([1, 2])).toEqual({})
    expect(sanitizePayload('x')).toEqual({})
  })
})

describe('encode / decode', () => {
  it('round-trips', () => {
    const payload = {
      anonId: ID_OLD,
      progress: { '2026-11-01': { bestScore: 42, bestSolution: solution } },
      settings: { colorblindMode: true },
    }
    const encoded = encodePayload(payload)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodePayload(encoded)).toEqual(payload)
  })

  it('returns null for garbage', () => {
    expect(decodePayload('!!!')).toBeNull()
    expect(decodePayload(Buffer.from('{not json').toString('base64url'))).toBeNull()
  })
})

describe('readPayload', () => {
  it('reads the three keys and tolerates malformed JSON', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.anonId]: ID_OLD,
      [STORAGE_KEYS.progress]: '{broken',
      [STORAGE_KEYS.settings]: JSON.stringify({ showBlipAnimations: false }),
      'laser-puzzle-calendar': '{"ignored":true}',
    })
    expect(readPayload(storage)).toEqual({ anonId: ID_OLD, settings: { showBlipAnimations: false } })
  })
})

describe('buildRedirectUrl', () => {
  it('keeps the path and query and adds the data as a fragment', () => {
    const url = buildRedirectUrl('https://new.example', '/game/2026-11-01?x=1', { anonId: ID_OLD })
    expect(url).toMatch(/^https:\/\/new\.example\/game\/2026-11-01\?x=1#migrate=v1\./)
    expect(decodePayload(url.split('#migrate=v1.')[1])).toEqual({ anonId: ID_OLD })
  })

  it('adds no fragment when there is nothing to carry', () => {
    expect(buildRedirectUrl('https://new.example', '/', {})).toBe('https://new.example/')
  })
})

describe('mergeIntoStorage', () => {
  it('imports everything into empty storage', () => {
    const storage = makeStorage()
    const result = mergeIntoStorage(storage, {
      anonId: ID_OLD,
      progress: { '2026-11-01': { bestScore: 42 } },
      settings: { colorblindMode: true },
    })
    expect(result).toEqual({ daysImported: 1, anonIdImported: true, settingsImported: true })
    expect(storage.getItem(STORAGE_KEYS.anonId)).toBe(ID_OLD)
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.progress)!)).toEqual({ '2026-11-01': { bestScore: 42 } })
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.settings)!)).toEqual({ colorblindMode: true })
  })

  it('keeps the higher score per day', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.progress]: JSON.stringify({
        '2026-11-01': { bestScore: 50, bestSolution: solution },
        '2026-11-02': { bestScore: 10 },
        '2026-11-03': { bestScore: 30 },
      }),
    })
    const result = mergeIntoStorage(storage, {
      progress: {
        '2026-11-01': { bestScore: 40 },
        '2026-11-02': { bestScore: 20 },
        '2026-11-03': { bestScore: 30 },
        '2026-11-04': { bestScore: 5 },
      },
    })
    expect(result.daysImported).toBe(2)
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.progress)!)).toEqual({
      '2026-11-01': { bestScore: 50, bestSolution: solution },
      '2026-11-02': { bestScore: 20 },
      '2026-11-03': { bestScore: 30 },
      '2026-11-04': { bestScore: 5 },
    })
  })

  it('keeps an existing player ID that has history here', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.anonId]: ID_NEW,
      [STORAGE_KEYS.progress]: JSON.stringify({ '2026-11-01': { bestScore: 1 } }),
    })
    const result = mergeIntoStorage(storage, { anonId: ID_OLD })
    expect(result.anonIdImported).toBe(false)
    expect(storage.getItem(STORAGE_KEYS.anonId)).toBe(ID_NEW)
  })

  it('adopts the old player ID when this browser has no history here', () => {
    const storage = makeStorage({ [STORAGE_KEYS.anonId]: ID_NEW })
    mergeIntoStorage(storage, { anonId: ID_OLD })
    expect(storage.getItem(STORAGE_KEYS.anonId)).toBe(ID_OLD)
  })

  it('keeps settings already saved here', () => {
    const storage = makeStorage({ [STORAGE_KEYS.settings]: JSON.stringify({ colorblindMode: false }) })
    const result = mergeIntoStorage(storage, { settings: { colorblindMode: true } })
    expect(result.settingsImported).toBe(false)
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.settings)!)).toEqual({ colorblindMode: false })
  })

  it('replaces malformed existing progress', () => {
    const storage = makeStorage({ [STORAGE_KEYS.progress]: '[1,2' })
    mergeIntoStorage(storage, { progress: { '2026-11-01': { bestScore: 3 } } })
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.progress)!)).toEqual({ '2026-11-01': { bestScore: 3 } })
  })

  it('is idempotent', () => {
    const storage = makeStorage()
    const payload = { anonId: ID_OLD, progress: { '2026-11-01': { bestScore: 42 } } }
    mergeIntoStorage(storage, payload)
    const before = new Map(storage.data)
    expect(mergeIntoStorage(storage, payload)).toEqual({ daysImported: 0, anonIdImported: false, settingsImported: false })
    expect(storage.data).toEqual(before)
  })
})

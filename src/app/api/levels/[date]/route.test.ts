import { GET } from './route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    level: { findUnique: jest.fn() },
  },
}))

const mockLevel = {
  id: 1,
  date: '2026-01-01',
  gridWidth: 15,
  gridHeight: 20,
  laserConfig: JSON.stringify({ x: 0, y: 0, direction: 'right' }),
  obstacles: JSON.stringify([{ x: 5, y: 5 }]),
  mirrorsAvailable: 8,
  optimalScore: 42,
  optimalSolution: JSON.stringify([{ x: 3, y: 3, type: '/' }]),
}

function makeRequest(date: string): Request {
  return new Request(`http://localhost/api/levels/${date}`)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('isDateAccessible via GET /api/levels/[date]', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_MODE
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('allows access to today\'s date (UTC)', async () => {
    // 2026-01-01T00:00:00Z — adjusted time is 2026-01-01T14:00:00Z → date '2026-01-01'
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const res = await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })
    expect(res.status).toBe(200)
  })

  it('allows access to past dates', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-10T12:00:00Z'))

    const res = await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })
    expect(res.status).toBe(200)
  })

  it('blocks a date that is still in the future from all timezones', async () => {
    // At 2026-01-01T09:00:00Z, adjusted time is 2026-01-01T23:00:00Z → date '2026-01-01'
    // So '2026-01-02' is not yet accessible.
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T09:00:00Z'))

    const res = await GET(makeRequest('2026-01-02'), { params: Promise.resolve({ date: '2026-01-02' }) })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toMatch(/not yet available/)
  })

  it('allows access once UTC+14 has crossed midnight for the next date', async () => {
    // At 2026-01-01T11:00:00Z, adjusted time is 2026-01-02T01:00:00Z → date '2026-01-02'
    // So '2026-01-02' becomes accessible.
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T11:00:00Z'))

    const res = await GET(makeRequest('2026-01-02'), { params: Promise.resolve({ date: '2026-01-02' }) })
    expect(res.status).toBe(200)
  })

  it('blocks a date two days in the future', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T12:00:00Z'))

    const res = await GET(makeRequest('2026-01-03'), { params: Promise.resolve({ date: '2026-01-03' }) })
    expect(res.status).toBe(403)
  })

  it('treats the exact boundary (UTC+14 midnight) as accessible', async () => {
    // At 2026-01-01T10:00:00Z, adjusted = 2026-01-02T00:00:00Z → date '2026-01-02'
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T10:00:00Z'))

    const res = await GET(makeRequest('2026-01-02'), { params: Promise.resolve({ date: '2026-01-02' }) })
    expect(res.status).toBe(200)
  })

  it('bypasses date check in DEV mode', async () => {
    process.env.NEXT_PUBLIC_APP_MODE = 'DEV'
    jest.useFakeTimers()
    // Far future date
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const res = await GET(makeRequest('2099-12-31'), { params: Promise.resolve({ date: '2099-12-31' }) })
    // Would be 403 without DEV mode; should proceed to DB lookup instead
    // DB will return null since mock returns mockLevel (date mismatch handled below)
    expect(res.status).not.toBe(403)
  })
})

describe('GET /api/levels/[date] — input validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_MODE
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 400 for invalid date format', async () => {
    const res = await GET(makeRequest('not-a-date'), { params: Promise.resolve({ date: 'not-a-date' }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/invalid date format/i)
  })

  it('returns 400 for partial date (YYYY-MM)', async () => {
    const res = await GET(makeRequest('2026-01'), { params: Promise.resolve({ date: '2026-01' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 for date with extra characters', async () => {
    const res = await GET(makeRequest('2026-01-01abc'), { params: Promise.resolve({ date: '2026-01-01abc' }) })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/levels/[date] — DB responses', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    // Use DEV mode so access control doesn't interfere with DB-layer tests
    process.env.NEXT_PUBLIC_APP_MODE = 'DEV'
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 404 when level not found', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toMatch(/not found/i)
  })

  it('returns 200 with parsed level data', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)

    const res = await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.level).toMatchObject({
      id: 1,
      date: '2026-01-01',
      gridWidth: 15,
      gridHeight: 20,
      mirrorsAvailable: 8,
      optimalScore: 42,
    })
    // JSON fields should be parsed into objects, not strings
    expect(data.level.laserConfig).toEqual({ x: 0, y: 0, direction: 'right' })
    expect(data.level.obstacles).toEqual([{ x: 5, y: 5 }])
    expect(data.level.optimalSolution).toEqual([{ x: 3, y: 3, type: '/' }])
  })

  it('returns null optimalSolution when not set', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue({
      ...mockLevel,
      optimalSolution: null,
    })

    const res = await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.level.optimalSolution).toBeNull()
  })

  it('queries prisma with the correct date key', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)

    await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })

    expect(prisma.level.findUnique).toHaveBeenCalledWith({ where: { date: '2026-01-01' } })
  })

  it('returns 500 on unexpected DB error', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockRejectedValue(new Error('DB connection failed'))

    const res = await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toMatch(/internal server error/i)
  })
})

describe('GET /api/levels/[date] — response headers', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_APP_MODE = 'DEV'
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('includes X-Site-Version header from env', async () => {
    process.env.NEXT_PUBLIC_SITE_VERSION = '1.2.3'

    const res = await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })
    expect(res.headers.get('X-Site-Version')).toBe('1.2.3')
  })

  it('falls back to "dev" when NEXT_PUBLIC_SITE_VERSION is not set', async () => {
    delete process.env.NEXT_PUBLIC_SITE_VERSION

    const res = await GET(makeRequest('2026-01-01'), { params: Promise.resolve({ date: '2026-01-01' }) })
    expect(res.headers.get('X-Site-Version')).toBe('dev')
  })
})

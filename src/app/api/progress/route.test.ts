import { POST } from './route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    level: { findUnique: jest.fn() },
    scoreSubmission: {
      findUnique: jest.fn(),
      create: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}))

const mockLevel = {
  id: 'level-1',
  date: '2026-01-01',
  gridWidth: 5,
  gridHeight: 5,
  laserConfig: JSON.stringify({ x: -1, y: 2, direction: 'right' }),
  obstacles: JSON.stringify([]),
  mirrorsAvailable: 3,
  optimalScore: 10,
}

const validAnonId = '00000000-0000-0000-0000-000000000001'

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/progress', () => {
  it('returns score and histogram on successful submission', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)
    ;(prisma.scoreSubmission.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.scoreSubmission.create as jest.Mock).mockResolvedValue({})
    ;(prisma.scoreSubmission.groupBy as jest.Mock).mockResolvedValue([
      { score: 6, _count: { score: 1 } },
    ])

    const res = await POST(
      makeRequest({
        levelDate: '2026-01-01',
        mirrors: [{ x: 2, y: 2, type: '/' }],
        anonId: validAnonId,
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.score).toBeGreaterThan(0)
    expect(data.histogram).toHaveProperty('distribution')
    expect(data.histogram).toHaveProperty('totalPlayers')
  })

  it('returns 400 for invalid anonId', async () => {
    const res = await POST(
      makeRequest({
        levelDate: '2026-01-01',
        mirrors: [],
        anonId: 'bad-id',
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing fields', async () => {
    const res = await POST(
      makeRequest({ anonId: validAnonId })
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when level not found', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await POST(
      makeRequest({
        levelDate: '9999-01-01',
        mirrors: [],
        anonId: validAnonId,
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 for duplicate submission', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)
    ;(prisma.scoreSubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing',
      score: 5,
    })

    const res = await POST(
      makeRequest({
        levelDate: '2026-01-01',
        mirrors: [],
        anonId: validAnonId,
      })
    )
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid mirrors', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)
    ;(prisma.scoreSubmission.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await POST(
      makeRequest({
        levelDate: '2026-01-01',
        mirrors: [{ x: -1, y: 0, type: '/' }],
        anonId: validAnonId,
      })
    )
    expect(res.status).toBe(400)
  })
})

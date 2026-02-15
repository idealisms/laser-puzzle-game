import { GET } from './route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    level: { findUnique: jest.fn() },
    scoreSubmission: {
      groupBy: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

const mockLevel = { id: 'level-1', date: '2026-01-01' }

beforeEach(() => {
  jest.clearAllMocks()
})

function makeRequest(params: Record<string, string>): Request {
  const url = new URL('http://localhost/api/scores/histogram')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

describe('GET /api/scores/histogram', () => {
  it('returns distribution and total players', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)
    ;(prisma.scoreSubmission.groupBy as jest.Mock).mockResolvedValue([
      { score: 5, _count: { score: 2 } },
      { score: 8, _count: { score: 3 } },
    ])

    const res = await GET(makeRequest({ date: '2026-01-01' }))
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.distribution).toEqual({ '5': 2, '8': 3 })
    expect(data.totalPlayers).toBe(5)
    expect(data.playerScore).toBeNull()
  })

  it('returns playerScore when anonId provided', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(mockLevel)
    ;(prisma.scoreSubmission.groupBy as jest.Mock).mockResolvedValue([])
    ;(prisma.scoreSubmission.findUnique as jest.Mock).mockResolvedValue({
      score: 7,
    })

    const res = await GET(
      makeRequest({ date: '2026-01-01', anonId: 'some-id' })
    )
    const data = await res.json()
    expect(data.playerScore).toBe(7)
  })

  it('returns 400 when date is missing', async () => {
    const res = await GET(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when level not found', async () => {
    ;(prisma.level.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await GET(makeRequest({ date: '9999-01-01' }))
    expect(res.status).toBe(404)
  })
})

import { GET } from './route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    level: { findMany: jest.fn() },
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/levels/calendar', () => {
  it('returns calendar array with correct shape', async () => {
    ;(prisma.level.findMany as jest.Mock).mockResolvedValue([
      { date: '2026-01-01', optimalScore: 10 },
      { date: '2026-01-02', optimalScore: 15 },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.calendar).toHaveLength(2)
    expect(data.calendar[0]).toEqual({
      date: '2026-01-01',
      available: true,
      completed: false,
      bestScore: null,
      optimalScore: 10,
    })
  })

  it('passes date filter to prisma query', async () => {
    ;(prisma.level.findMany as jest.Mock).mockResolvedValue([])

    await GET()

    expect(prisma.level.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: { lte: expect.any(String) } },
        orderBy: { date: 'desc' },
      })
    )
  })
})

import { generateStaticParams } from './page'

const EXPECTED_DATES = [
  '2026-01-22',
  '2026-01-24',
  '2026-02-26',
  '2026-03-06',
  '2026-03-13',
  '2026-03-15',
  '2026-03-17',
  '2026-03-22',
  '2026-03-26',
  '2026-03-31',
  '2026-04-05',
  '2026-04-06',
]

describe('generateStaticParams', () => {
  it('returns all 12 puzzle dates from pack.json', () => {
    const params = generateStaticParams()
    expect(params).toHaveLength(12)
  })

  it('returns objects with a date property', () => {
    const params = generateStaticParams()
    expect(params[0]).toHaveProperty('date')
    expect(typeof params[0].date).toBe('string')
  })

  it('returns dates in chronological order', () => {
    const params = generateStaticParams()
    const dates = params.map((p) => p.date)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })

  it('returns exactly the expected puzzle dates', () => {
    const params = generateStaticParams()
    expect(params.map((p) => p.date)).toEqual(EXPECTED_DATES)
  })
})

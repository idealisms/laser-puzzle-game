import { getLocalDateString } from './date'

describe('getLocalDateString', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const date = new Date(2026, 1, 3) // Feb 3, 2026 (month is 0-indexed)
    expect(getLocalDateString(date)).toBe('2026-02-03')
  })

  it('pads single-digit months with leading zero', () => {
    const date = new Date(2026, 0, 15) // Jan 15, 2026
    expect(getLocalDateString(date)).toBe('2026-01-15')
  })

  it('pads single-digit days with leading zero', () => {
    const date = new Date(2026, 11, 5) // Dec 5, 2026
    expect(getLocalDateString(date)).toBe('2026-12-05')
  })

  it('uses getFullYear, getMonth, getDate (local) not UTC methods', () => {
    // Create any date object
    const date = new Date(2026, 1, 3, 23, 0, 0)

    // The result should match what local date methods return
    const expectedYear = date.getFullYear()
    const expectedMonth = String(date.getMonth() + 1).padStart(2, '0')
    const expectedDay = String(date.getDate()).padStart(2, '0')
    const expected = `${expectedYear}-${expectedMonth}-${expectedDay}`

    expect(getLocalDateString(date)).toBe(expected)
  })

  it('handles end of year correctly', () => {
    const date = new Date(2026, 11, 31) // Dec 31, 2026
    expect(getLocalDateString(date)).toBe('2026-12-31')
  })

  it('handles beginning of year correctly', () => {
    const date = new Date(2027, 0, 1) // Jan 1, 2027
    expect(getLocalDateString(date)).toBe('2027-01-01')
  })

  it('defaults to current date when no argument provided', () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(getLocalDateString()).toBe(expected)
  })
})

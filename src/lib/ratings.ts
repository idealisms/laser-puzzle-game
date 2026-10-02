export interface PuzzleRating {
  rating: number
  ratedAt: string
}

const STORAGE_KEY = 'laser-puzzle-ratings'

export function getRatings(): Record<string, PuzzleRating> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function saveRating(date: string, rating: number): void {
  try {
    const ratings = getRatings()
    ratings[date] = { rating, ratedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings))
  } catch {}
}

export function exportRatingsCSV(
  dates: string[],
  optimalScores: Record<string, number>,
): string {
  const ratings = getRatings()
  const rows = [['date', 'rating', 'optimalScore', 'ratedAt']]
  for (const date of [...dates].sort()) {
    const r = ratings[date]
    rows.push([
      date,
      r ? String(r.rating) : '',
      String(optimalScores[date] ?? ''),
      r ? r.ratedAt : '',
    ])
  }
  return rows.map(r => r.join(',')).join('\n')
}

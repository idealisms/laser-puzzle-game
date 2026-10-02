'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { getRatings, exportRatingsCSV, PuzzleRating } from '@/lib/ratings'

const RATING_LABELS: Record<number, string> = {
  1: 'Terrible',
  2: 'Bad',
  3: 'Meh',
  4: 'OK',
  5: 'Good',
  6: 'Great',
  7: 'Love it',
}

interface CalendarEntry {
  date: string
  optimalScore: number
}

type Filter = 'all' | 'unrated' | 'rated'

export default function RatePage() {
  const [calendar, setCalendar] = useState<CalendarEntry[]>([])
  const [ratings, setRatings] = useState<Record<string, PuzzleRating>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    fetch('/api/levels/calendar')
      .then(r => r.json())
      .then(data => {
        setCalendar(data.calendar)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    setRatings(getRatings())
  }, [])

  function handleExport() {
    const scores: Record<string, number> = {}
    calendar.forEach(e => {
      scores[e.date] = e.optimalScore
    })
    const csv = exportRatingsCSV(
      calendar.map(e => e.date),
      scores,
    )
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'puzzle-ratings.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const ratedCount = calendar.filter(e => ratings[e.date]).length

  const filtered = calendar.filter(e => {
    if (filter === 'unrated') return !ratings[e.date]
    if (filter === 'rated') return !!ratings[e.date]
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const aRated = !!ratings[a.date]
    const bRated = !!ratings[b.date]
    if (aRated !== bRated) return aRated ? 1 : -1
    return b.date.localeCompare(a.date)
  })

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Puzzle Ratings</h1>
              {!loading && (
                <p className="text-gray-400 text-sm mt-1">
                  {ratedCount}/{calendar.length} rated
                </p>
              )}
            </div>
            <button
              onClick={handleExport}
              disabled={ratedCount === 0}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-40 border border-gray-600 px-3 py-1 rounded transition-colors"
            >
              Export CSV
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            {(['all', 'unrated', 'rated'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-sm capitalize transition-colors ${
                  filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : sorted.length === 0 ? (
            <p className="text-gray-500">No puzzles match this filter.</p>
          ) : (
            <div className="space-y-1">
              {sorted.map(entry => {
                const r = ratings[entry.date]
                return (
                  <Link
                    key={entry.date}
                    href={`/rate/${entry.date}`}
                    className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-3 transition-colors"
                  >
                    <span className="font-mono text-gray-200">{entry.date}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">optimal {entry.optimalScore}</span>
                      {r ? (
                        <span className="text-emerald-400 font-medium w-28 text-right">
                          {r.rating}/7 — {RATING_LABELS[r.rating]}
                        </span>
                      ) : (
                        <span className="text-gray-600 w-28 text-right">unrated</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

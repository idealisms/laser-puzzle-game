'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/ui/Header'
import { Card } from '@/components/ui/Card'

interface DayStats {
  date: string
  players: number
}

interface StatsData {
  days: DayStats[]
  futurePuzzleCount: number
  lastFutureDate: string | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load stats')
        return res.json()
      })
      .then((data) => {
        setStats(data)
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  const reversedDays = stats ? [...stats.days].reverse() : []

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Stats</h1>

          {loading && (
            <div className="text-center text-gray-400 py-12">Loading...</div>
          )}

          {error && (
            <Card className="text-center py-8">
              <p className="text-red-400">{error}</p>
            </Card>
          )}

          {stats && (
            <>
              <Card className="mb-6">
                <div className="flex flex-col sm:flex-row sm:gap-12 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Total puzzles published</div>
                    <div className="text-2xl font-bold text-emerald-400">{stats.days.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Future puzzles</div>
                    <div className="text-2xl font-bold text-emerald-400">{stats.futurePuzzleCount}</div>
                    {stats.lastFutureDate && (
                      <div className="text-xs text-gray-500 mt-0.5">through {formatDate(stats.lastFutureDate)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Total players (all time)</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {stats.days.reduce((sum, d) => sum + d.players, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 font-medium text-right">Players</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reversedDays.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-gray-500">
                          No data yet.
                        </td>
                      </tr>
                    ) : (
                      reversedDays.map((day) => (
                        <tr key={day.date} className="border-b border-gray-800 last:border-0">
                          <td className="py-2.5 pr-4 text-gray-300">{formatDate(day.date)}</td>
                          <td className="py-2.5 text-right font-mono text-emerald-400">
                            {day.players.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

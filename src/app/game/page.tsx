'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface CalendarEntry {
  date: string
  available: boolean
  completed: boolean
  stars: number
}

function StarDisplay({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((n) => (
        <svg
          key={n}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill={n <= stars ? '#ffd700' : '#333333'}
          stroke={n <= stars ? '#ffd700' : '#666666'}
          strokeWidth="1"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  )
}

export default function LevelSelectPage() {
  const { user, loading: authLoading } = useAuth()
  const [calendar, setCalendar] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCalendar() {
      try {
        const res = await fetch('/api/levels/calendar')
        if (res.ok) {
          const data = await res.json()
          setCalendar(data.calendar)
        }
      } catch (error) {
        console.error('Failed to fetch calendar:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCalendar()
  }, [])

  const todayDate = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-emerald-400">
            Laser Puzzle
          </Link>
          <nav className="flex items-center gap-4">
            {authLoading ? (
              <span className="text-gray-400">Loading...</span>
            ) : user ? (
              <Link
                href="/profile"
                className="text-gray-300 hover:text-white transition-colors"
              >
                {user.username}
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="secondary" size="sm">
                  Login
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Select a Puzzle</h1>

          {loading ? (
            <div className="text-center text-gray-400 py-12">
              Loading puzzles...
            </div>
          ) : calendar.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-400 mb-4">No puzzles available yet.</p>
              <p className="text-sm text-gray-500">
                Check back later for daily puzzles!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {calendar.map((entry) => {
                const isToday = entry.date === todayDate
                const dateObj = new Date(entry.date + 'T00:00:00')
                const dayName = dateObj.toLocaleDateString('en-US', {
                  weekday: 'short',
                })
                const monthDay = dateObj.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })

                return (
                  <Link key={entry.date} href={`/game/${entry.date}`}>
                    <Card
                      padding="sm"
                      className={`
                        hover:border-emerald-500 transition-colors cursor-pointer text-center
                        ${isToday ? 'border-emerald-500 bg-emerald-500/10' : ''}
                        ${entry.completed ? 'bg-gray-800/50' : ''}
                      `}
                    >
                      <div className="text-xs text-gray-500 mb-1">{dayName}</div>
                      <div className="font-semibold mb-2">{monthDay}</div>
                      {entry.completed ? (
                        <div className="flex justify-center">
                          <StarDisplay stars={entry.stars} />
                        </div>
                      ) : isToday ? (
                        <div className="text-xs text-emerald-400">Today</div>
                      ) : (
                        <div className="text-xs text-gray-500">Play</div>
                      )}
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/">
              <Button variant="secondary">Back to Home</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/Card'
import { Header } from '@/components/ui/Header'
import { getLocalDateString } from '@/lib/date'

interface CalendarEntry {
  date: string
  available: boolean
  completed: boolean
  bestScore: number | null
  optimalScore: number
}

interface LocalProgress {
  bestScore: number
}

export default function LevelSelectPage() {
  const { user } = useAuth()
  const [calendar, setCalendar] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    // Load cache immediately for instant display
    try {
      const cached = localStorage.getItem('laser-puzzle-calendar')
      if (cached) {
        setCalendar(JSON.parse(cached))
        setLoading(false)
        setRefreshing(true)
      }
    } catch {}

    async function fetchCalendar() {
      try {
        const res = await fetch('/api/levels/calendar')
        if (res.ok) {
          const data = await res.json()
          let calendarData: CalendarEntry[] = data.calendar

          // For non-logged-in users, merge localStorage progress
          if (!user) {
            const localProgress = getLocalProgress()
            calendarData = calendarData.map((entry) => {
              const local = localProgress[entry.date]
              if (local) {
                return {
                  ...entry,
                  completed: true,
                  bestScore: local.bestScore,
                }
              }
              return entry
            })
          }

          setCalendar(calendarData)
          try {
            localStorage.setItem('laser-puzzle-calendar', JSON.stringify(calendarData))
          } catch {}
        }
      } catch (error) {
        console.error('Failed to fetch calendar:', error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    }

    fetchCalendar()
  }, [user])

  function getLocalProgress(): Record<string, LocalProgress> {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem('laser-puzzle-progress')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  const todayDate = getLocalDateString()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <h1 className="text-3xl font-bold">Select a Puzzle</h1>
            {refreshing && !loading && (
              <div className="w-5 h-5 border-2 border-gray-600 border-t-emerald-400 rounded-full animate-spin" />
            )}
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-12">
              Loading puzzles...
            </div>
          ) : calendar.filter((e) => e.date <= todayDate).length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-400 mb-4">No puzzles available yet.</p>
              <p className="text-sm text-gray-500">
                Check back later for daily puzzles!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {calendar.filter((e) => e.date <= todayDate).map((entry) => {
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
                      {entry.completed && entry.bestScore ? (
                        <div className="text-xs text-emerald-400">
                          {entry.bestScore} pts ({Math.round((entry.bestScore / entry.optimalScore) * 100)}%)
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
        </div>
      </main>
    </div>
  )
}

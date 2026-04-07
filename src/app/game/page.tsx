'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Header } from '@/components/ui/Header'
import { getLocalDateString } from '@/lib/date'
import { isPackMode, getCalendarFetchUrl } from '@/lib/packMode'

// Daily mode calendar entry (from /api/levels/calendar)
interface CalendarEntry {
  date: string
  available: boolean
  completed: boolean
  bestScore: number | null
  optimalScore: number
}

// Pack mode index entry (from /puzzles/index.json)
interface PackIndexEntry {
  date: string
  name: string
  number: number
  optimalScore: number
}

interface LocalProgress {
  bestScore: number
}

function getLocalProgress(): Record<string, LocalProgress> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem('laser-puzzle-progress')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function PackPuzzleGrid() {
  const [puzzles, setPuzzles] = useState<PackIndexEntry[]>([])
  const [loading, setLoading] = useState(true)
  const packSubtitle = process.env.NEXT_PUBLIC_PACK_SUBTITLE
  const dailySiteUrl = process.env.NEXT_PUBLIC_DAILY_SITE_URL
  const dailySiteName = process.env.NEXT_PUBLIC_DAILY_SITE_NAME

  useEffect(() => {
    async function fetchIndex() {
      try {
        const res = await fetch(getCalendarFetchUrl())
        if (res.ok) {
          const data: PackIndexEntry[] = await res.json()
          setPuzzles(data)
        }
      } catch (error) {
        console.error('Failed to fetch puzzle index:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIndex()
  }, [])

  const localProgress = getLocalProgress()

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        subtitle={packSubtitle ?? undefined}
        dailySiteUrl={dailySiteUrl ?? undefined}
        dailySiteName={dailySiteName ?? undefined}
      />

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Select a Puzzle</h1>

          {loading ? (
            <div className="text-center text-gray-400 py-12">
              Loading puzzles...
            </div>
          ) : puzzles.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-400">No puzzles available.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {puzzles.map((entry) => {
                const progress = localProgress[entry.date]
                const completed = !!progress
                const bestScore = progress?.bestScore ?? null
                const isPerfect = completed && bestScore === entry.optimalScore

                return (
                  <Link key={entry.date} href={`/game/${entry.date}`}>
                    <Card
                      padding="sm"
                      className={`
                        hover:border-emerald-500 transition-colors cursor-pointer text-center
                        ${completed ? 'bg-gray-800/50' : ''}
                      `}
                    >
                      <div className="text-xs text-gray-500 mb-1">#{entry.number}</div>
                      <div className="font-semibold mb-2 text-sm leading-tight">{entry.name}</div>
                      {completed && bestScore ? (
                        <div className={`text-xs ${isPerfect ? 'text-yellow-400' : 'text-emerald-400'}`}>
                          {isPerfect && '\u2605 '}{bestScore} pts ({Math.round((bestScore / entry.optimalScore) * 100)}%)
                        </div>
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

function DailyPuzzleGrid() {
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
        const res = await fetch(getCalendarFetchUrl())
        if (res.ok) {
          const data = await res.json()
          let calendarData: CalendarEntry[] = data.calendar

          // Merge localStorage progress
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
  }, [])

  const todayDate = getLocalDateString()
  const devMode = process.env.NEXT_PUBLIC_APP_MODE === 'DEV'
  const visibleCalendar = devMode ? calendar : calendar.filter((e) => e.date <= todayDate)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <h1 className="text-3xl font-bold">Select a Puzzle</h1>
            {devMode && (
              <span className="text-xs font-mono bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-2 py-0.5 rounded">
                DEV
              </span>
            )}
            {refreshing && !loading && (
              <div className="w-5 h-5 border-2 border-gray-600 border-t-emerald-400 rounded-full animate-spin" />
            )}
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-12">
              Loading puzzles...
            </div>
          ) : visibleCalendar.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-400 mb-4">No puzzles available yet.</p>
              <p className="text-sm text-gray-500">
                Check back later for daily puzzles!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {visibleCalendar.map((entry) => {
                const isToday = entry.date === todayDate
                const dateObj = new Date(entry.date + 'T00:00:00')
                const dayName = dateObj.toLocaleDateString('en-US', {
                  weekday: 'short',
                })
                const monthDay = dateObj.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })

                const isPerfect = entry.completed && entry.bestScore === entry.optimalScore

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
                        <div className={`text-xs ${isPerfect ? 'text-yellow-400' : 'text-emerald-400'}`}>
                          {isPerfect && '\u2605 '}{entry.bestScore} pts ({Math.round((entry.bestScore / entry.optimalScore) * 100)}%)
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

export default function LevelSelectPage() {
  if (isPackMode()) {
    return <PackPuzzleGrid />
  }
  return <DailyPuzzleGrid />
}

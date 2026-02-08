'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Header } from '@/components/ui/Header'

interface UserStats {
  gamesPlayed: number
  gamesWon: number
  totalScore: number
  bestScore: number
  longestPath: number
  daysPlayed: number
  currentStreak: number
  longestStreak: number
}

function StatCard({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <Card padding="sm" className="text-center">
      <div className="text-3xl font-bold text-emerald-400 mb-1">
        {value.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </Card>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    async function fetchStats() {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchStats()
    }
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Your Profile</h1>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Statistics</h2>
            {stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Games Played" value={stats.gamesPlayed} />
                <StatCard label="Total Score" value={stats.totalScore} />
                <StatCard label="Best Score" value={stats.bestScore} />
                <StatCard label="Longest Path" value={stats.longestPath} />
                <StatCard label="Days Played" value={stats.daysPlayed} />
                <StatCard label="Current Streak" value={stats.currentStreak} suffix=" days" />
                <StatCard label="Longest Streak" value={stats.longestStreak} suffix=" days" />
                <StatCard label="Win Rate" value={stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0} suffix="%" />
              </div>
            ) : (
              <Card className="text-center py-8">
                <p className="text-gray-400">No stats available yet. Play some puzzles!</p>
              </Card>
            )}
          </div>

          <div className="flex gap-4">
            <Link href="/game">
              <Button>Play a Puzzle</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary">Back to Home</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Header } from '@/components/ui/Header'
import { getLocalDateString } from '@/lib/date'

export default function HomePage() {
  const { user } = useAuth()

  const todayDate = getLocalDateString()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-emerald-400">Laser</span> Puzzle
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Place mirrors to direct the laser and create the longest possible path!
          </p>

          <Card className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Today&apos;s Puzzle</h2>
            <p className="text-gray-400 mb-6">{todayDate}</p>
            <Link href={`/game/${todayDate}`}>
              <Button size="lg">Play Now</Button>
            </Link>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/game">
              <Card className="hover:border-emerald-500 transition-colors cursor-pointer h-full">
                <h3 className="text-lg font-semibold mb-2">Browse Levels</h3>
                <p className="text-sm text-gray-400">
                  Play previous daily puzzles
                </p>
              </Card>
            </Link>
            {user && (
              <Link href="/profile">
                <Card className="hover:border-emerald-500 transition-colors cursor-pointer h-full">
                  <h3 className="text-lg font-semibold mb-2">Your Stats</h3>
                  <p className="text-sm text-gray-400">
                    View your progress and streaks
                  </p>
                </Card>
              </Link>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

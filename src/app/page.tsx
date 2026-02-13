'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Header } from '@/components/ui/Header'
import { getLocalDateString } from '@/lib/date'

export default function HomePage() {
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

        </div>
      </main>
    </div>
  )
}

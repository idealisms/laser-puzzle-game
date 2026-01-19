'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function HomePage() {
  const { user, loading, logout } = useAuth()

  const todayDate = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-emerald-400">
            Laser Puzzle
          </Link>
          <nav className="flex items-center gap-4">
            {loading ? (
              <span className="text-gray-400">Loading...</span>
            ) : user ? (
              <>
                <Link
                  href="/profile"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {user.username}
                </Link>
                <Button variant="secondary" size="sm" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="secondary" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

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

          <div className="mt-12 text-left">
            <h3 className="text-lg font-semibold mb-4">How to Play</h3>
            <ul className="text-gray-400 space-y-2">
              <li>
                <span className="text-emerald-400 mr-2">1.</span>
                Click on empty cells to place mirrors
              </li>
              <li>
                <span className="text-emerald-400 mr-2">2.</span>
                Click on a placed mirror to toggle its orientation (/ or \)
              </li>
              <li>
                <span className="text-emerald-400 mr-2">3.</span>
                Right-click to remove a mirror
              </li>
              <li>
                <span className="text-emerald-400 mr-2">4.</span>
                Create the longest laser path to earn more stars!
              </li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center text-gray-500 text-sm">
        A daily puzzle game
      </footer>
    </div>
  )
}

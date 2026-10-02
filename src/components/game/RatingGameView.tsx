'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useGame } from '@/hooks/useGame'
import { LevelConfig } from '@/game/types'
import { ResponsiveCanvas } from '@/components/game/ResponsiveCanvas'
import { Header } from '@/components/ui/Header'
import { getRatings, saveRating } from '@/lib/ratings'

const DEFAULT_LEVEL: LevelConfig = {
  gridWidth: 15,
  gridHeight: 20,
  laserConfig: { x: 0, y: 0, direction: 'right' },
  obstacles: [],
  mirrorsAvailable: 10,
  optimalScore: 100,
}

const RATING_LABELS: Record<number, string> = {
  1: 'Terrible',
  2: 'Bad',
  3: 'Meh',
  4: 'OK',
  5: 'Good',
  6: 'Great',
  7: 'Love it',
}

interface RatingGameViewProps {
  date: string
}

export function RatingGameView({ date }: RatingGameViewProps) {
  const [level, setLevel] = useState<LevelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optimalShown, setOptimalShown] = useState(false)
  const [currentRating, setCurrentRating] = useState<number | null>(null)
  const [nextUnrated, setNextUnrated] = useState<string | null>(null)

  const {
    gameState,
    handleCellClick,
    handleCellRightClick,
    handleReset,
    loadLevel,
    loadSolution,
  } = useGame(level || DEFAULT_LEVEL)

  useEffect(() => {
    async function fetchLevel() {
      try {
        const res = await fetch(`/api/levels/${date}`)
        if (res.ok) {
          const data = await res.json()
          setLevel(data.level)
          loadLevel(data.level)
        } else {
          setError(res.status === 404 ? 'No puzzle for this date' : 'Failed to load puzzle')
        }
      } catch {
        setError('Failed to load puzzle')
      } finally {
        setLoading(false)
      }
    }

    async function fetchNextUnrated() {
      try {
        const res = await fetch('/api/levels/calendar')
        if (!res.ok) return
        const data = await res.json()
        const ratings = getRatings()
        const unrated: string[] = data.calendar
          .map((e: { date: string }) => e.date)
          .filter((d: string) => d !== date && !ratings[d])
          .sort()
        setNextUnrated(unrated[0] ?? null)
      } catch {}
    }

    const saved = getRatings()[date]
    if (saved) setCurrentRating(saved.rating)

    fetchLevel()
    fetchNextUnrated()
  }, [date, loadLevel])

  const handleShowOptimal = useCallback(() => {
    if (!level?.optimalSolution) return
    const mirrors = level.optimalSolution.map(m => ({
      position: { x: m.x, y: m.y },
      type: m.type as '/' | '\\',
    }))
    loadSolution(mirrors)
    setOptimalShown(true)
  }, [level, loadSolution])

  const handleRate = useCallback(
    (rating: number) => {
      saveRating(date, rating)
      setCurrentRating(rating)
    },
    [date],
  )

  if (!loading && (error || !level)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        {error || 'No puzzle available'}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        rightContent={
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <Link href="/rate" className="hover:text-white transition-colors">
              ← All puzzles
            </Link>
            <span>{date}</span>
          </div>
        }
      />

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              {loading ? (
                <div className="w-full aspect-[3/4] lg:aspect-auto lg:h-[800px] flex items-center justify-center text-gray-500">
                  Loading puzzle...
                </div>
              ) : (
                <ResponsiveCanvas
                  gameState={gameState}
                  onCellClick={handleCellClick}
                  onCellRightClick={handleCellRightClick}
                />
              )}
            </div>

            <div className="lg:w-64 space-y-4">
              {/* Score */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Path Length</h3>
                    <div className="text-3xl font-bold text-white">{gameState.score}</div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Mirrors</h3>
                    <div className="text-xl font-bold text-white">
                      {gameState.placedMirrors.length}
                      <span className="text-gray-500">
                        /{level?.mirrorsAvailable ?? DEFAULT_LEVEL.mirrorsAvailable}
                      </span>
                    </div>
                  </div>
                </div>
                {level && (
                  <div
                    className="mt-2 pt-2 border-t border-gray-700 cursor-pointer hover:bg-gray-700/50 -mx-4 px-4 -mb-4 pb-4 rounded-b-lg transition-colors"
                    onClick={handleShowOptimal}
                  >
                    <div className="text-sm text-gray-400">
                      Optimal:{' '}
                      <span className="text-amber-400 font-medium">{level.optimalScore}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {optimalShown ? 'Tap to show again' : 'Tap to show'}
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <button
                  onClick={handleReset}
                  className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                >
                  Reset
                </button>
              </div>

              {/* Rating */}
              {optimalShown && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">How fun was it?</h3>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(n => (
                      <button
                        key={n}
                        onClick={() => handleRate(n)}
                        className={`py-2 rounded text-sm font-bold transition-colors ${
                          currentRating === n
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mb-3">
                    <span>boring</span>
                    <span>addictive</span>
                  </div>
                  {currentRating && (
                    <div className="text-sm text-emerald-400 font-medium text-center">
                      ✓ {RATING_LABELS[currentRating]}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation after rating */}
              {currentRating && (
                <div className="space-y-2">
                  {nextUnrated ? (
                    <Link
                      href={`/rate/${nextUnrated}`}
                      className="block w-full py-2 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-sm text-center transition-colors"
                    >
                      Next unrated →
                    </Link>
                  ) : (
                    <p className="text-center text-gray-500 text-sm py-2">All puzzles rated!</p>
                  )}
                  <Link
                    href="/rate"
                    className="block w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm text-center transition-colors"
                  >
                    ← All puzzles
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

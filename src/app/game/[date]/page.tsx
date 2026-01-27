'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useGame } from '@/hooks/useGame'
import { LevelConfig, Mirror } from '@/game/types'
import { ResponsiveCanvas } from '@/components/game/ResponsiveCanvas'
import { MirrorPalette } from '@/components/game/MirrorPalette'
import { ScoreDisplay } from '@/components/game/ScoreDisplay'
import { GameControls } from '@/components/game/GameControls'
import { LevelComplete } from '@/components/game/LevelComplete'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const DEFAULT_LEVEL: LevelConfig = {
  gridWidth: 15,
  gridHeight: 20,
  laserConfig: { x: 0, y: 0, direction: 'right' },
  obstacles: [],
  mirrorsAvailable: 10,
  optimalScore: 100,
}

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const date = params.date as string

  const [level, setLevel] = useState<LevelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [isNewBest, setIsNewBest] = useState(false)
  const [previousBest, setPreviousBest] = useState<number | null>(null)
  const [bestSolution, setBestSolution] = useState<Mirror[] | null>(null)

  const {
    gameState,
    handleCellClick,
    handleCellRightClick,
    handleSelectMirrorType,
    handleReset,
    loadLevel,
    loadSolution,
  } = useGame(level || DEFAULT_LEVEL)

  // Fetch level data
  useEffect(() => {
    async function fetchLevel() {
      try {
        const res = await fetch(`/api/levels/${date}`)
        if (res.ok) {
          const data = await res.json()
          setLevel(data.level)
          loadLevel(data.level)
        } else if (res.status === 404) {
          setError('No puzzle available for this date')
        } else {
          setError('Failed to load puzzle')
        }
      } catch {
        setError('Failed to load puzzle')
      } finally {
        setLoading(false)
      }
    }

    // Fetch user progress for this level
    async function fetchProgress() {
      if (user) {
        try {
          const res = await fetch(`/api/progress?date=${date}`)
          if (res.ok) {
            const data = await res.json()
            if (data.progress) {
              setPreviousBest(data.progress.bestScore)
              if (data.progress.bestSolution) {
                setBestSolution(data.progress.bestSolution)
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch progress:', error)
        }
      } else {
        // Load from localStorage for non-logged-in users
        const localProgress = getLocalProgress()
        if (localProgress[date]) {
          setPreviousBest(localProgress[date].bestScore)
          if (localProgress[date].bestSolution) {
            setBestSolution(localProgress[date].bestSolution)
          }
        }
      }
    }

    fetchLevel()
    fetchProgress()
  }, [date, loadLevel, user])

  function getLocalProgress(): Record<string, { bestScore: number; bestSolution?: Mirror[] }> {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem('laser-puzzle-progress')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  function saveLocalProgress(levelDate: string, score: number, solution: Mirror[]) {
    try {
      const progress = getLocalProgress()
      const existing = progress[levelDate]
      if (!existing || score > existing.bestScore) {
        progress[levelDate] = { bestScore: score, bestSolution: solution }
        localStorage.setItem('laser-puzzle-progress', JSON.stringify(progress))
        return true // isNewBest
      }
      return false
    } catch {
      return false
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!user) {
      // For non-logged-in users, save to localStorage
      const newBest = saveLocalProgress(date, gameState.score, gameState.placedMirrors)
      setIsNewBest(newBest)
      if (newBest) {
        setPreviousBest(gameState.score)
        setBestSolution(gameState.placedMirrors)
      }
      setShowComplete(true)
      return
    }

    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelDate: date,
          score: gameState.score,
          solution: gameState.placedMirrors,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setIsNewBest(data.progress.isNewBest)
        setPreviousBest(data.progress.bestScore)
        if (data.progress.isNewBest) {
          setBestSolution(gameState.placedMirrors)
        }
      }
    } catch (error) {
      console.error('Failed to save progress:', error)
    }

    setShowComplete(true)
  }, [user, date, gameState])

  const handlePlayAgain = useCallback(() => {
    setShowComplete(false)
    handleReset()
  }, [handleReset])

  const handleRestoreBest = useCallback(() => {
    if (bestSolution) {
      loadSolution(bestSolution)
    }
  }, [bestSolution, loadSolution])

  const handleNextLevel = useCallback(() => {
    // Navigate to the next available date
    const currentDate = new Date(date + 'T00:00:00')
    const nextDate = new Date(currentDate)
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateStr = nextDate.toISOString().split('T')[0]
    router.push(`/game/${nextDateStr}`)
  }, [date, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading puzzle...</div>
      </div>
    )
  }

  if (error || !level) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-4">Puzzle Not Found</h2>
          <p className="text-gray-400 mb-6">{error || 'No puzzle available'}</p>
          <Link href="/game">
            <Button>Browse Puzzles</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-emerald-400">
            Laser Puzzle
          </Link>
          <div className="text-gray-400">{date}</div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <ResponsiveCanvas
                gameState={gameState}
                onCellClick={handleCellClick}
                onCellRightClick={handleCellRightClick}
              />
            </div>

            <div className="lg:w-64 space-y-4">
              <ScoreDisplay
                score={gameState.score}
                bestScore={previousBest}
                canRestore={bestSolution !== null && gameState.score < (previousBest ?? 0)}
                onRestoreBest={handleRestoreBest}
              />

              <MirrorPalette
                selectedType={gameState.selectedMirrorType}
                onSelectType={handleSelectMirrorType}
                mirrorsAvailable={level.mirrorsAvailable}
                mirrorsPlaced={gameState.placedMirrors.length}
              />

              <GameControls
                onReset={handleReset}
                onSubmit={handleSubmit}
                canSubmit={gameState.score > 0}
              />

              {!user && (
                <Card padding="sm" className="text-center">
                  <p className="text-sm text-gray-400 mb-2">
                    Login to save your progress
                  </p>
                  <Link href="/login">
                    <Button variant="secondary" size="sm">
                      Login
                    </Button>
                  </Link>
                </Card>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/game" className="text-gray-500 hover:text-gray-300 text-sm">
              Back to Level Select
            </Link>
          </div>
        </div>
      </main>

      <LevelComplete
        isOpen={showComplete}
        onClose={() => setShowComplete(false)}
        score={gameState.score}
        optimalScore={level.optimalScore}
        isNewBest={isNewBest}
        onPlayAgain={handlePlayAgain}
        onNextLevel={handleNextLevel}
      />
    </div>
  )
}

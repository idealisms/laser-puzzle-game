'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useGame } from '@/hooks/useGame'
import { LevelConfig, Mirror } from '@/game/types'
import { ResponsiveCanvas } from '@/components/game/ResponsiveCanvas'
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
  const { user } = useAuth()
  const date = params.date as string

  const [level, setLevel] = useState<LevelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [isNewBest, setIsNewBest] = useState(false)
  const [bestSolution, setBestSolution] = useState<Mirror[] | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [submittedScore, setSubmittedScore] = useState<number>(0)
  const [sessionBestScore, setSessionBestScore] = useState(0)
  const [sessionBestSolution, setSessionBestSolution] = useState<Mirror[] | null>(null)

  const {
    gameState,
    handleCellClick,
    handleCellRightClick,
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
              if (data.progress.bestSolution) {
                setBestSolution(data.progress.bestSolution)
              }
              // If user has already completed this level, mark as submitted
              if (data.progress.completed) {
                setHasSubmitted(true)
                setSubmittedScore(data.progress.bestScore)
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
          if (localProgress[date].bestSolution) {
            setBestSolution(localProgress[date].bestSolution)
          }
          // Mark as submitted if there's existing progress
          setHasSubmitted(true)
          setSubmittedScore(localProgress[date].bestScore)
        }
      }
    }

    fetchLevel()
    fetchProgress()
  }, [date, loadLevel, user])

  // Track the best score discovered during the current session (pre-submission)
  useEffect(() => {
    if (level && !hasSubmitted && gameState.placedMirrors.length > 0 && gameState.score > sessionBestScore) {
      setSessionBestScore(gameState.score)
      setSessionBestSolution([...gameState.placedMirrors])
    }
  }, [level, gameState.score, gameState.placedMirrors, hasSubmitted, sessionBestScore])

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
    // Store the submitted score before any async operations
    const scoreAtSubmit = gameState.score

    if (!user) {
      // For non-logged-in users, save to localStorage
      const newBest = saveLocalProgress(date, scoreAtSubmit, gameState.placedMirrors)
      setIsNewBest(newBest)
      setBestSolution([...gameState.placedMirrors])
      setSubmittedScore(scoreAtSubmit)
      setHasSubmitted(true)
      setShowComplete(true)
      return
    }

    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelDate: date,
          score: scoreAtSubmit,
          solution: gameState.placedMirrors,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setIsNewBest(data.progress.isNewBest)
      }
    } catch (error) {
      console.error('Failed to save progress:', error)
    }

    setBestSolution([...gameState.placedMirrors])
    setSubmittedScore(scoreAtSubmit)
    setHasSubmitted(true)
    setShowComplete(true)
  }, [user, date, gameState])

  const handleRestoreBest = useCallback(() => {
    if (hasSubmitted && bestSolution) {
      loadSolution(bestSolution)
    } else if (!hasSubmitted && sessionBestSolution) {
      loadSolution(sessionBestSolution)
    }
  }, [hasSubmitted, bestSolution, sessionBestSolution, loadSolution])

  const handleShowResults = useCallback(() => {
    setShowComplete(true)
  }, [])

  const handleShowOptimal = useCallback(() => {
    if (level?.optimalSolution) {
      // Convert OptimalMirror[] to Mirror[] format
      const mirrors = level.optimalSolution.map(m => ({
        position: { x: m.x, y: m.y },
        type: m.type as '/' | '\\',
      }))
      loadSolution(mirrors)
    }
  }, [level, loadSolution])

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
                bestScore={hasSubmitted ? submittedScore : (sessionBestScore > 0 ? sessionBestScore : null)}
                canRestore={hasSubmitted
                  ? bestSolution !== null
                  : sessionBestSolution !== null}
                onRestoreBest={handleRestoreBest}
                mirrorsPlaced={gameState.placedMirrors.length}
                mirrorsAvailable={level.mirrorsAvailable}
                hasSubmitted={hasSubmitted}
                optimalScore={level.optimalScore}
                onShowOptimal={handleShowOptimal}
              />

              <GameControls
                onReset={handleReset}
                onSubmit={handleSubmit}
                canSubmit={gameState.score > 0}
                hasSubmitted={hasSubmitted}
                onShowResults={handleShowResults}
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
        score={submittedScore}
        optimalScore={level.optimalScore}
        date={date}
      />
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useGame } from '@/hooks/useGame'
import { LevelConfig, Mirror } from '@/game/types'
import { getOrCreateAnonId } from '@/lib/anonId'
import { HistogramData } from '@/components/game/LevelComplete'
import { ResponsiveCanvas } from '@/components/game/ResponsiveCanvas'
import { ScoreDisplay } from '@/components/game/ScoreDisplay'
import { GameControls } from '@/components/game/GameControls'
import { LevelComplete } from '@/components/game/LevelComplete'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Header } from '@/components/ui/Header'
import { HowToPlayModal } from '@/components/ui/HowToPlayModal'

const DEFAULT_LEVEL: LevelConfig = {
  gridWidth: 15,
  gridHeight: 20,
  laserConfig: { x: 0, y: 0, direction: 'right' },
  obstacles: [],
  mirrorsAvailable: 10,
  optimalScore: 100,
}

interface GameViewProps {
  date: string
}

export function GameView({ date }: GameViewProps) {
  const [level, setLevel] = useState<LevelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [bestSolution, setBestSolution] = useState<Mirror[] | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [submittedScore, setSubmittedScore] = useState<number>(0)
  const [sessionBestScore, setSessionBestScore] = useState(0)
  const [sessionBestSolution, setSessionBestSolution] = useState<Mirror[] | null>(null)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [histogramData, setHistogramData] = useState<HistogramData | null>(null)

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

    // Load progress from localStorage
    function fetchProgress() {
      const localProgress = getLocalProgress()
      if (localProgress[date]) {
        if (localProgress[date].bestSolution) {
          setBestSolution(localProgress[date].bestSolution)
        }
        setHasSubmitted(true)
        setSubmittedScore(localProgress[date].bestScore)
      }

      // Show tutorial for first-time players
      if (Object.keys(localProgress).length === 0) {
        setShowHowToPlay(true)
      }
    }

    fetchLevel()
    fetchProgress()
  }, [date, loadLevel])

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
    const mirrorPayload = gameState.placedMirrors.map(m => ({
      x: m.position.x,
      y: m.position.y,
      type: m.type,
    }))

    const body = {
      levelDate: date,
      mirrors: mirrorPayload,
      anonId: getOrCreateAnonId(),
    }

    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        setSubmittedScore(data.score)
        setHistogramData(data.histogram)
      } else {
        // Fallback to client-side score if server rejects (e.g. 409 duplicate)
        setSubmittedScore(gameState.score)
      }
    } catch (error) {
      console.error('Failed to save progress:', error)
      setSubmittedScore(gameState.score)
    }

    // Also save to localStorage for offline access
    saveLocalProgress(date, gameState.score, gameState.placedMirrors)
    setBestSolution([...gameState.placedMirrors])
    setHasSubmitted(true)
    setShowComplete(true)
  }, [date, gameState])

  const handleRestoreBest = useCallback(() => {
    if (hasSubmitted && bestSolution) {
      loadSolution(bestSolution)
    } else if (!hasSubmitted && sessionBestSolution) {
      loadSolution(sessionBestSolution)
    }
  }, [hasSubmitted, bestSolution, sessionBestSolution, loadSolution])

  const handleShowResults = useCallback(async () => {
    if (!histogramData) {
      try {
        const res = await fetch(`/api/scores/histogram?date=${date}&anonId=${getOrCreateAnonId()}`)
        if (res.ok) {
          const data = await res.json()
          setHistogramData({
            distribution: data.distribution,
            totalPlayers: data.totalPlayers,
          })
        }
      } catch (e) {
        console.error('Failed to fetch histogram:', e)
      }
    }
    setShowComplete(true)
  }, [histogramData, date])

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

  if (!loading && (error || !level)) {
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
      <Header rightContent={date} />

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
              <ScoreDisplay
                score={gameState.score}
                bestScore={hasSubmitted ? submittedScore : (sessionBestScore > 0 ? sessionBestScore : null)}
                canRestore={hasSubmitted
                  ? bestSolution !== null
                  : sessionBestSolution !== null}
                onRestoreBest={handleRestoreBest}
                mirrorsPlaced={gameState.placedMirrors.length}
                mirrorsAvailable={level?.mirrorsAvailable ?? DEFAULT_LEVEL.mirrorsAvailable}
                hasSubmitted={hasSubmitted}
                optimalScore={level?.optimalScore ?? DEFAULT_LEVEL.optimalScore}
                onShowOptimal={handleShowOptimal}
              />

              <GameControls
                onReset={handleReset}
                onSubmit={handleSubmit}
                canSubmit={gameState.score > 0}
                hasSubmitted={hasSubmitted}
                onShowResults={handleShowResults}
              />
            </div>
          </div>
        </div>
      </main>

      <LevelComplete
        isOpen={showComplete}
        onClose={() => setShowComplete(false)}
        score={submittedScore}
        optimalScore={level?.optimalScore ?? DEFAULT_LEVEL.optimalScore}
        date={date}
        histogram={histogramData}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />
    </div>
  )
}

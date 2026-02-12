'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Histogram } from './Histogram'

export interface HistogramData {
  distribution: Record<number, number>
  totalPlayers: number
}

interface LevelCompleteProps {
  isOpen: boolean
  onClose: () => void
  score: number
  optimalScore: number
  date: string
  histogram?: HistogramData | null
}

export function LevelComplete({
  isOpen,
  onClose,
  score,
  optimalScore,
  date,
  histogram,
}: LevelCompleteProps) {
  const [copied, setCopied] = useState(false)
  const percentage = Math.round((score / optimalScore) * 100)
  const isPerfect = score >= optimalScore

  const handleShare = async () => {
    const formattedDate = date.replace(/-/g, '/')
    const percentLine = isPerfect ? `${percentage}% 💯` : `${percentage}%`
    const shareText = `Laser Puzzle ${formattedDate}\n${percentLine}\nlaser-puzzle-game.vercel.app`

    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Level Complete!">
      <div className="text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-sm">Back to puzzle</span>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="text-4xl font-bold text-white mb-2">{score}</div>
        <div className="text-gray-400 mb-4">Path Length</div>

        <div className="mb-4">
          <div
            className={`text-2xl font-bold ${isPerfect ? 'text-emerald-400' : 'text-gray-300'}`}
          >
            {percentage}%
          </div>
          <div className="text-sm text-gray-500">
            {isPerfect ? 'Perfect!' : `Optimal: ${optimalScore}`}
          </div>
        </div>

        <div className="flex justify-center mt-6">
          <Button variant="primary" onClick={handleShare}>
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              {copied ? 'Copied!' : 'Share'}
            </span>
          </Button>
        </div>

        {histogram && (
          <Histogram
            distribution={histogram.distribution}
            playerScore={score}
            optimalScore={optimalScore}
            totalPlayers={histogram.totalPlayers}
          />
        )}
      </div>
    </Modal>
  )
}

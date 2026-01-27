'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface LevelCompleteProps {
  isOpen: boolean
  onClose: () => void
  score: number
  optimalScore: number
  isNewBest: boolean
  onPlayAgain: () => void
  onNextLevel?: () => void
}

export function LevelComplete({
  isOpen,
  onClose,
  score,
  optimalScore,
  isNewBest,
  onPlayAgain,
  onNextLevel,
}: LevelCompleteProps) {
  const percentage = Math.round((score / optimalScore) * 100)
  const isPerfect = score >= optimalScore

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Level Complete!">
      <div className="text-center">
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

        {isNewBest && (
          <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full inline-block mb-4">
            New Best!
          </div>
        )}

        <div className="flex gap-3 justify-center mt-6">
          <Button variant="secondary" onClick={onPlayAgain}>
            Play Again
          </Button>
          {onNextLevel && (
            <Button variant="primary" onClick={onNextLevel}>
              Next Level
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

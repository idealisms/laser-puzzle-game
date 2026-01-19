'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { STAR_COLORS } from '@/game/constants'

interface LevelCompleteProps {
  isOpen: boolean
  onClose: () => void
  score: number
  stars: number
  isNewBest: boolean
  onPlayAgain: () => void
  onNextLevel?: () => void
}

function Star({ filled, size = 32 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? STAR_COLORS.filled : STAR_COLORS.empty}
      stroke={filled ? STAR_COLORS.filled : '#666666'}
      strokeWidth="1"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export function LevelComplete({
  isOpen,
  onClose,
  score,
  stars,
  isNewBest,
  onPlayAgain,
  onNextLevel,
}: LevelCompleteProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Level Complete!">
      <div className="text-center">
        <div className="flex justify-center gap-2 mb-4">
          <Star filled={stars >= 1} size={40} />
          <Star filled={stars >= 2} size={40} />
          <Star filled={stars >= 3} size={40} />
        </div>

        <div className="text-4xl font-bold text-white mb-2">{score}</div>
        <div className="text-gray-400 mb-4">Path Length</div>

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

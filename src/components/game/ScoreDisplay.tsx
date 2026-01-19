'use client'

import { STAR_COLORS } from '@/game/constants'

interface ScoreDisplayProps {
  score: number
  stars: number
  thresholds: [number, number, number]
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={filled ? STAR_COLORS.filled : STAR_COLORS.empty}
      stroke={filled ? STAR_COLORS.filled : '#666666'}
      strokeWidth="1"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export function ScoreDisplay({ score, stars, thresholds }: ScoreDisplayProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Score</h3>
      <div className="text-3xl font-bold text-white mb-3">{score}</div>

      <div className="flex gap-1 mb-3">
        <Star filled={stars >= 1} />
        <Star filled={stars >= 2} />
        <Star filled={stars >= 3} />
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>1 Star:</span>
          <span>{thresholds[0]}+</span>
        </div>
        <div className="flex justify-between">
          <span>2 Stars:</span>
          <span>{thresholds[1]}+</span>
        </div>
        <div className="flex justify-between">
          <span>3 Stars:</span>
          <span>{thresholds[2]}+</span>
        </div>
      </div>
    </div>
  )
}

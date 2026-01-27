'use client'

interface ScoreDisplayProps {
  score: number
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Path Length</h3>
      <div className="text-3xl font-bold text-white">{score}</div>
    </div>
  )
}

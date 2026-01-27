'use client'

interface ScoreDisplayProps {
  score: number
  bestScore: number | null
  canRestore: boolean
  onRestoreBest: () => void
}

export function ScoreDisplay({
  score,
  bestScore,
  canRestore,
  onRestoreBest,
}: ScoreDisplayProps) {
  const showBest = bestScore !== null && score < bestScore

  return (
    <div
      className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${
        canRestore ? 'cursor-pointer hover:border-emerald-500 transition-colors' : ''
      }`}
      onClick={canRestore ? onRestoreBest : undefined}
    >
      <h3 className="text-sm font-medium text-gray-400 mb-2">Path Length</h3>
      <div className="text-3xl font-bold text-white">{score}</div>
      {showBest && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Best: <span className="text-emerald-400 font-medium">{bestScore}</span>
          </div>
          {canRestore && (
            <div className="text-xs text-gray-500 mt-1">Tap to restore</div>
          )}
        </div>
      )}
    </div>
  )
}

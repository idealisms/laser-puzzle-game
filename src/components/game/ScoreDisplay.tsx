'use client'

interface ScoreDisplayProps {
  score: number
  bestScore: number | null
  canRestore: boolean
  onRestoreBest: () => void
  mirrorsPlaced: number
  mirrorsAvailable: number
  hasSubmitted: boolean
  optimalScore: number
  onShowOptimal: () => void
}

export function ScoreDisplay({
  score,
  bestScore,
  canRestore,
  onRestoreBest,
  mirrorsPlaced,
  mirrorsAvailable,
  hasSubmitted,
  optimalScore,
  onShowOptimal,
}: ScoreDisplayProps) {
  const bestLabel = hasSubmitted ? 'Submitted:' : 'Best:'
  const showBestSection = bestScore !== null && bestScore > 0
  const isLastSection = !hasSubmitted

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1">Path Length</h3>
          <div className="text-3xl font-bold text-white">{score}</div>
        </div>
        <div className="text-right">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Mirrors</h3>
          <div className="text-xl font-bold text-white">
            {mirrorsPlaced}<span className="text-gray-500">/{mirrorsAvailable}</span>
          </div>
        </div>
      </div>
      {showBestSection && (
        <div
          className={`mt-2 pt-2 border-t border-gray-700 ${
            canRestore
              ? `cursor-pointer hover:bg-gray-700/50 -mx-4 px-4 transition-colors ${
                  isLastSection ? '-mb-4 pb-4 rounded-b-lg' : 'pb-2'
                }`
              : ''
          }`}
          onClick={canRestore ? onRestoreBest : undefined}
        >
          <div className="text-sm text-gray-400">
            {bestLabel} <span className="text-emerald-400 font-medium">{bestScore}</span>
          </div>
          {canRestore && (
            <div className="text-xs text-gray-500 mt-1">Tap to restore</div>
          )}
        </div>
      )}
      {hasSubmitted && (
        <div
          className="mt-2 pt-2 border-t border-gray-700 cursor-pointer hover:bg-gray-700/50 -mx-4 px-4 -mb-4 pb-4 rounded-b-lg transition-colors"
          onClick={onShowOptimal}
        >
          <div className="text-sm text-gray-400">
            Optimal: <span className="text-amber-400 font-medium">{optimalScore}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Tap to show</div>
        </div>
      )}
    </div>
  )
}

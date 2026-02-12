'use client'

interface HistogramProps {
  distribution: Record<number, number>
  playerScore: number
  optimalScore: number
  totalPlayers: number
}

export function Histogram({ distribution, playerScore, optimalScore, totalPlayers }: HistogramProps) {
  const scores = Object.keys(distribution).map(Number).sort((a, b) => a - b)
  if (scores.length === 0) return null

  const maxCount = Math.max(...scores.map(s => distribution[s]))

  return (
    <div className="mt-6">
      <div className="text-sm text-gray-400 mb-3">
        Score Distribution ({totalPlayers} player{totalPlayers !== 1 ? 's' : ''})
      </div>
      <div className="space-y-0.5">
        {scores.map((score) => {
          const count = distribution[score]
          const isPlayerScore = score === playerScore
          const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0

          return (
            <div key={score} className="flex items-center gap-2 text-xs">
              <div className="w-8 text-right text-gray-500 shrink-0 tabular-nums">
                {score}
              </div>
              <div className="flex-1 h-4 bg-gray-700/50 rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm ${
                    isPlayerScore ? 'bg-emerald-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.max(widthPercent, count > 0 ? 3 : 0)}%` }}
                />
              </div>
              <div className="w-6 text-gray-500 shrink-0 tabular-nums">
                {count}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-sm mr-1 align-middle" />
        Your score: {playerScore}
      </div>
    </div>
  )
}

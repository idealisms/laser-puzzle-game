'use client'

import { MirrorType } from '@/game/types'

interface MirrorPaletteProps {
  selectedType: MirrorType
  onSelectType: (type: MirrorType) => void
  mirrorsAvailable: number
  mirrorsPlaced: number
}

export function MirrorPalette({
  selectedType,
  onSelectType,
  mirrorsAvailable,
  mirrorsPlaced,
}: MirrorPaletteProps) {
  const mirrorsRemaining = mirrorsAvailable - mirrorsPlaced

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Mirror Type</h3>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => onSelectType('/')}
          className={`
            w-12 h-12 flex items-center justify-center rounded-lg border-2 transition-all
            text-2xl font-bold
            ${
              selectedType === '/'
                ? 'border-emerald-500 bg-emerald-500/20 text-white'
                : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
            }
          `}
        >
          /
        </button>
        <button
          onClick={() => onSelectType('\\')}
          className={`
            w-12 h-12 flex items-center justify-center rounded-lg border-2 transition-all
            text-2xl font-bold
            ${
              selectedType === '\\'
                ? 'border-emerald-500 bg-emerald-500/20 text-white'
                : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
            }
          `}
        >
          \
        </button>
      </div>
      <div className="text-sm text-gray-400">
        Mirrors: <span className="text-white font-medium">{mirrorsRemaining}</span>
        <span className="text-gray-500"> / {mirrorsAvailable}</span>
      </div>
    </div>
  )
}

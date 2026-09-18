'use client'

import { GameState, Position } from '@/game/types'
import { GameCanvas } from '@/components/game/GameCanvas'
import { CELL_SIZE } from '@/game/constants'

interface ResponsiveCanvasProps {
  gameState: GameState
  onCellClick: (position: Position) => void
  onCellRightClick: (position: Position) => void
  scale: number
}

export function ResponsiveCanvas({
  gameState,
  onCellClick,
  onCellRightClick,
  scale,
}: ResponsiveCanvasProps) {
  const canvasWidth = gameState.level.gridWidth * CELL_SIZE
  const canvasHeight = gameState.level.gridHeight * CELL_SIZE

  return (
    <div className="w-full flex justify-center overflow-hidden">
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          width: canvasWidth,
          height: canvasHeight * scale,
        }}
      >
        <GameCanvas
          gameState={gameState}
          onCellClick={onCellClick}
          onCellRightClick={onCellRightClick}
          scale={scale}
        />
      </div>
    </div>
  )
}

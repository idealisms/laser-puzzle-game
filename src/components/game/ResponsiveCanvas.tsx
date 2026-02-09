'use client'

import { GameState, Position } from '@/game/types'
import { useResponsiveScale } from '@/hooks/useResponsiveScale'
import { GameCanvas } from '@/components/game/GameCanvas'
import { OptimalOverlay } from '@/game/engine/Renderer'
import { CELL_SIZE } from '@/game/constants'

interface ResponsiveCanvasProps {
  gameState: GameState
  onCellClick: (position: Position) => void
  onCellRightClick: (position: Position) => void
  optimalOverlay?: OptimalOverlay
}

export function ResponsiveCanvas({
  gameState,
  onCellClick,
  onCellRightClick,
  optimalOverlay,
}: ResponsiveCanvasProps) {
  const canvasWidth = gameState.level.gridWidth * CELL_SIZE
  const canvasHeight = gameState.level.gridHeight * CELL_SIZE

  const { scale, containerRef } = useResponsiveScale({ canvasWidth })

  return (
    <div ref={containerRef} className="w-full flex justify-center">
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
          optimalOverlay={optimalOverlay}
        />
      </div>
    </div>
  )
}

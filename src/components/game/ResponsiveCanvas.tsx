'use client'

import { GameState, Position } from '@/game/types'
import { GameCanvas } from '@/components/game/GameCanvas'
import { CELL_SIZE } from '@/game/constants'

const BORDER_W = 2  // matches border-2 on <canvas> in GameCanvas

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
  const canvasWidth = gameState.level.gridWidth * CELL_SIZE   // 600
  const canvasHeight = gameState.level.gridHeight * CELL_SIZE  // 800
  const bW = canvasWidth + BORDER_W * 2   // 604
  const bH = canvasHeight + BORDER_W * 2  // 804

  // Outer div is sized to the visual (post-scale) dimensions so the parent
  // layout sees the correct inline size and can position siblings alongside it.
  // overflow:hidden clips the inner div's unscaled layout box.
  return (
    <div
      data-testid="grid"
      style={{
        width: Math.round(bW * scale),
        height: Math.round(bH * scale),
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
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

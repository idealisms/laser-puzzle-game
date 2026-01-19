'use client'

import { GameState, Position } from '@/game/types'
import { useCanvas } from '@/hooks/useCanvas'

interface GameCanvasProps {
  gameState: GameState
  onCellClick: (position: Position) => void
  onCellRightClick: (position: Position) => void
}

export function GameCanvas({
  gameState,
  onCellClick,
  onCellRightClick,
}: GameCanvasProps) {
  const {
    canvasRef,
    canvasWidth,
    canvasHeight,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
    handleContextMenu,
  } = useCanvas({ gameState, onCellClick, onCellRightClick })

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="border-2 border-gray-700 rounded-lg cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  )
}

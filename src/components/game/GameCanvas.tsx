'use client'

import { GameState, Position } from '@/game/types'
import { useCanvas } from '@/hooks/useCanvas'
import { OptimalOverlay } from '@/game/engine/Renderer'

interface GameCanvasProps {
  gameState: GameState
  onCellClick: (position: Position) => void
  onCellRightClick: (position: Position) => void
  scale?: number
  optimalOverlay?: OptimalOverlay
}

export function GameCanvas({
  gameState,
  onCellClick,
  onCellRightClick,
  scale = 1,
  optimalOverlay,
}: GameCanvasProps) {
  const {
    canvasRef,
    canvasWidth,
    canvasHeight,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
    handleContextMenu,
    handleTouchStart,
    handleTouchEnd,
  } = useCanvas({ gameState, onCellClick, onCellRightClick, scale, optimalOverlay })

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="border-2 border-gray-700 rounded-lg cursor-crosshair"
      style={{ touchAction: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    />
  )
}

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
    isEraserMode,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleMouseLeave,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useCanvas({ gameState, onCellClick, onCellRightClick, scale, optimalOverlay })

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className={`border-2 rounded-lg ${
        isEraserMode
          ? 'border-red-500 cursor-not-allowed'
          : 'border-gray-700 cursor-crosshair'
      }`}
      style={{ touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  )
}

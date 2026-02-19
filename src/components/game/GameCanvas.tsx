'use client'

import { GameState, Position } from '@/game/types'
import { useCanvas } from '@/hooks/useCanvas'
import { useSettings } from '@/context/SettingsContext'

interface GameCanvasProps {
  gameState: GameState
  onCellClick: (position: Position) => void
  onCellRightClick: (position: Position) => void
  scale?: number
}

export function GameCanvas({
  gameState,
  onCellClick,
  onCellRightClick,
  scale = 1,
}: GameCanvasProps) {
  const { settings } = useSettings()
  const {
    canvasRef,
    canvasWidth,
    canvasHeight,
    isEraserMode,
    hoverMirrorType,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleMouseLeave,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useCanvas({ gameState, onCellClick, onCellRightClick, scale })

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className={`border-2 rounded-lg ${
        isEraserMode
          ? `${settings.colorblindMode ? 'border-orange-500' : 'border-red-500'} cursor-not-allowed`
          : hoverMirrorType === '\\'
          ? 'border-gray-700 cursor-not-allowed'
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

'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Position, GameState } from '@/game/types'
import { Renderer } from '@/game/engine/Renderer'
import { CELL_SIZE } from '@/game/constants'

interface UseCanvasProps {
  gameState: GameState
  onCellClick: (position: Position) => void
  onCellRightClick: (position: Position) => void
  scale?: number
}

export function useCanvas({
  gameState,
  onCellClick,
  onCellRightClick,
  scale = 1,
}: UseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [hoverPos, setHoverPos] = useState<Position | null>(null)

  const { level } = gameState
  const canvasWidth = level.gridWidth * CELL_SIZE
  const canvasHeight = level.gridHeight * CELL_SIZE

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    rendererRef.current = new Renderer(ctx, canvasWidth, canvasHeight)
  }, [canvasWidth, canvasHeight])

  // Render game state
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(gameState, hoverPos)
    }
  }, [gameState, hoverPos])

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Position | null => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const rect = canvas.getBoundingClientRect()
      const x = Math.floor((e.clientX - rect.left) / (CELL_SIZE * scale))
      const y = Math.floor((e.clientY - rect.top) / (CELL_SIZE * scale))

      if (x >= 0 && x < level.gridWidth && y >= 0 && y < level.gridHeight) {
        return { x, y }
      }
      return null
    },
    [level.gridWidth, level.gridHeight, scale]
  )

  const getCellFromTouch = useCallback(
    (touch: React.Touch): Position | null => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const rect = canvas.getBoundingClientRect()
      const x = Math.floor((touch.clientX - rect.left) / (CELL_SIZE * scale))
      const y = Math.floor((touch.clientY - rect.top) / (CELL_SIZE * scale))

      if (x >= 0 && x < level.gridWidth && y >= 0 && y < level.gridHeight) {
        return { x, y }
      }
      return null
    },
    [level.gridWidth, level.gridHeight, scale]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
    },
    []
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (e.changedTouches.length > 0) {
        const pos = getCellFromTouch(e.changedTouches[0])
        if (pos) {
          onCellClick(pos)
        }
      }
    },
    [getCellFromTouch, onCellClick]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCellFromEvent(e)
      setHoverPos(pos)
    },
    [getCellFromEvent]
  )

  const handleMouseLeave = useCallback(() => {
    setHoverPos(null)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCellFromEvent(e)
      if (pos) {
        onCellClick(pos)
      }
    },
    [getCellFromEvent, onCellClick]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const pos = getCellFromEvent(e)
      if (pos) {
        onCellRightClick(pos)
      }
    },
    [getCellFromEvent, onCellRightClick]
  )

  return {
    canvasRef,
    canvasWidth,
    canvasHeight,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
    handleContextMenu,
    handleTouchStart,
    handleTouchEnd,
  }
}

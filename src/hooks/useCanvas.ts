'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Position, GameState } from '@/game/types'
import { Renderer, OptimalOverlay } from '@/game/engine/Renderer'
import { CELL_SIZE } from '@/game/constants'

const LONG_PRESS_MS = 400
const MOVE_THRESHOLD_PX = 10

interface UseCanvasProps {
  gameState: GameState
  onCellClick: (position: Position) => void
  onCellRightClick: (position: Position) => void
  scale?: number
  optimalOverlay?: OptimalOverlay
}

export function useCanvas({
  gameState,
  onCellClick,
  onCellRightClick,
  scale = 1,
  optimalOverlay,
}: UseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [hoverPos, setHoverPos] = useState<Position | null>(null)
  const [isEraserMode, setIsEraserMode] = useState(false)

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastErasedCellRef = useRef<string | null>(null)

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
      rendererRef.current.render(gameState, hoverPos, optimalOverlay, isEraserMode)
    }
  }, [gameState, hoverPos, optimalOverlay, isEraserMode])

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

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const hasMirrorAt = useCallback(
    (pos: Position): boolean => {
      return gameState.placedMirrors.some(
        (m) => m.position.x === pos.x && m.position.y === pos.y
      )
    },
    [gameState.placedMirrors]
  )

  const eraseMirrorAt = useCallback(
    (pos: Position) => {
      const key = `${pos.x},${pos.y}`
      if (key === lastErasedCellRef.current) return
      if (!hasMirrorAt(pos)) return
      lastErasedCellRef.current = key
      onCellRightClick(pos)
    },
    [hasMirrorAt, onCellRightClick]
  )

  // --- Mouse handlers ---

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return
      const pos = getCellFromEvent(e)
      pressStartPosRef.current = { x: e.clientX, y: e.clientY }

      if (pos && hasMirrorAt(pos)) {
        cancelLongPress()
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null
          setIsEraserMode(true)
          lastErasedCellRef.current = null
          eraseMirrorAt(pos)
        }, LONG_PRESS_MS)
      }
    },
    [getCellFromEvent, hasMirrorAt, cancelLongPress, eraseMirrorAt]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return

      if (isEraserMode) {
        setIsEraserMode(false)
        lastErasedCellRef.current = null
        cancelLongPress()
        pressStartPosRef.current = null
        return
      }

      cancelLongPress()

      if (pressStartPosRef.current) {
        const pos = getCellFromEvent(e)
        if (pos) {
          onCellClick(pos)
        }
      }
      pressStartPosRef.current = null
    },
    [isEraserMode, cancelLongPress, getCellFromEvent, onCellClick]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCellFromEvent(e)
      setHoverPos(pos)

      // Check movement threshold for long-press cancellation
      if (longPressTimerRef.current && pressStartPosRef.current) {
        const dx = e.clientX - pressStartPosRef.current.x
        const dy = e.clientY - pressStartPosRef.current.y
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD_PX) {
          cancelLongPress()
          pressStartPosRef.current = null
        }
      }

      // Drag-to-erase in eraser mode
      if (isEraserMode && pos) {
        eraseMirrorAt(pos)
      }
    },
    [getCellFromEvent, isEraserMode, cancelLongPress, eraseMirrorAt]
  )

  const handleMouseLeave = useCallback(() => {
    setHoverPos(null)
    if (!isEraserMode) {
      cancelLongPress()
      pressStartPosRef.current = null
    }
  }, [cancelLongPress, isEraserMode])

  // When in eraser mode, track the pointer at document level so we can
  // detect mouseup outside the canvas and cancel if the pointer strays
  // more than one cell's distance from the canvas edge.
  useEffect(() => {
    if (!isEraserMode) return

    const scaledCell = CELL_SIZE * scale

    const onDocMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const outsideX = Math.max(rect.left - e.clientX, e.clientX - rect.right, 0)
      const outsideY = Math.max(rect.top - e.clientY, e.clientY - rect.bottom, 0)

      if (outsideX > scaledCell || outsideY > scaledCell) {
        setIsEraserMode(false)
        lastErasedCellRef.current = null
        pressStartPosRef.current = null
      }
    }

    const onDocMouseUp = () => {
      setIsEraserMode(false)
      lastErasedCellRef.current = null
      pressStartPosRef.current = null
    }

    document.addEventListener('mousemove', onDocMouseMove)
    document.addEventListener('mouseup', onDocMouseUp)
    return () => {
      document.removeEventListener('mousemove', onDocMouseMove)
      document.removeEventListener('mouseup', onDocMouseUp)
    }
  }, [isEraserMode, scale])

  // --- Touch handlers ---

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      const pos = getCellFromTouch(touch)
      pressStartPosRef.current = { x: touch.clientX, y: touch.clientY }

      if (pos && hasMirrorAt(pos)) {
        cancelLongPress()
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null
          setIsEraserMode(true)
          lastErasedCellRef.current = null
          eraseMirrorAt(pos)
        }, LONG_PRESS_MS)
      }
    },
    [getCellFromTouch, hasMirrorAt, cancelLongPress, eraseMirrorAt]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (e.touches.length !== 1) return
      const touch = e.touches[0]

      // Check movement threshold for long-press cancellation
      if (longPressTimerRef.current && pressStartPosRef.current) {
        const dx = touch.clientX - pressStartPosRef.current.x
        const dy = touch.clientY - pressStartPosRef.current.y
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD_PX) {
          cancelLongPress()
          pressStartPosRef.current = null
        }
      }

      // Drag-to-erase in eraser mode
      if (isEraserMode) {
        const pos = getCellFromTouch(touch)
        if (pos) {
          eraseMirrorAt(pos)
          setHoverPos(pos)
        }
      }
    },
    [isEraserMode, cancelLongPress, getCellFromTouch, eraseMirrorAt]
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()

      if (isEraserMode) {
        setIsEraserMode(false)
        lastErasedCellRef.current = null
        cancelLongPress()
        pressStartPosRef.current = null
        return
      }

      cancelLongPress()

      if (pressStartPosRef.current && e.changedTouches.length > 0) {
        const pos = getCellFromTouch(e.changedTouches[0])
        if (pos) {
          onCellClick(pos)
        }
      }
      pressStartPosRef.current = null
    },
    [isEraserMode, cancelLongPress, getCellFromTouch, onCellClick]
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
    isEraserMode,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleMouseLeave,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}

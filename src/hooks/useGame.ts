'use client'

import { useState, useCallback } from 'react'
import { GameState, LevelConfig, Position, MirrorType } from '@/game/types'
import {
  createInitialGameState,
  placeMirror,
  removeMirror,
  toggleMirrorType,
  setSelectedMirrorType,
  resetGame,
  canPlaceMirror,
} from '@/game/engine/GameState'

export function useGame(levelConfig: LevelConfig) {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(levelConfig)
  )

  const handleCellClick = useCallback(
    (position: Position) => {
      // Check if there's already a mirror at this position
      const existingMirror = gameState.placedMirrors.find(
        (m) => m.position.x === position.x && m.position.y === position.y
      )

      if (existingMirror) {
        // Toggle the mirror type
        setGameState((prev) => toggleMirrorType(prev, position))
      } else if (canPlaceMirror(gameState, position)) {
        // Place a new mirror
        setGameState((prev) =>
          placeMirror(prev, position, prev.selectedMirrorType)
        )
      }
    },
    [gameState]
  )

  const handleCellRightClick = useCallback((position: Position) => {
    // Remove mirror at position
    setGameState((prev) => removeMirror(prev, position))
  }, [])

  const handleSelectMirrorType = useCallback((type: MirrorType) => {
    setGameState((prev) => setSelectedMirrorType(prev, type))
  }, [])

  const handleReset = useCallback(() => {
    setGameState((prev) => resetGame(prev))
  }, [])

  const loadLevel = useCallback((config: LevelConfig) => {
    setGameState(createInitialGameState(config))
  }, [])

  return {
    gameState,
    handleCellClick,
    handleCellRightClick,
    handleSelectMirrorType,
    handleReset,
    loadLevel,
  }
}

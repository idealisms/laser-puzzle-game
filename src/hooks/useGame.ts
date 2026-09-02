'use client'

import { useState, useCallback, useRef } from 'react'
import { GameState, LevelConfig, Position, MirrorType, Mirror } from '@/game/types'
import {
  createInitialGameState,
  placeMirror,
  removeMirror,
  toggleMirrorType,
  setSelectedMirrorType,
  resetGame,
  canPlaceMirror,
  loadSolution as loadSolutionState,
} from '@/game/engine/GameState'

export function useGame(levelConfig: LevelConfig) {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(levelConfig)
  )
  // Counts explicit mirror erasures (left-click cycle-to-empty, right-click, drag-erase) —
  // not mirrors cleared via Reset or loading a solution. Read via getMirrorsErasedCount.
  const erasedCountRef = useRef(0)

  const handleCellClick = useCallback(
    (position: Position) => {
      // Check if there's already a mirror at this position
      const existingMirror = gameState.placedMirrors.find(
        (m) => m.position.x === position.x && m.position.y === position.y
      )

      if (existingMirror) {
        // Cycle: if '/', change to '\'; if '\', remove
        if (existingMirror.type === '/') {
          setGameState((prev) => toggleMirrorType(prev, position))
        } else {
          erasedCountRef.current += 1
          setGameState((prev) => removeMirror(prev, position))
        }
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
    setGameState((prev) => {
      const next = removeMirror(prev, position)
      if (next !== prev) erasedCountRef.current += 1
      return next
    })
  }, [])

  const getMirrorsErasedCount = useCallback(() => erasedCountRef.current, [])

  const handleSelectMirrorType = useCallback((type: MirrorType) => {
    setGameState((prev) => setSelectedMirrorType(prev, type))
  }, [])

  const handleReset = useCallback(() => {
    setGameState((prev) => resetGame(prev))
  }, [])

  const loadLevel = useCallback((config: LevelConfig) => {
    erasedCountRef.current = 0
    setGameState(createInitialGameState(config))
  }, [])

  const loadSolution = useCallback((mirrors: Mirror[]) => {
    setGameState((prev) => loadSolutionState(prev, mirrors))
  }, [])

  return {
    gameState,
    handleCellClick,
    handleCellRightClick,
    handleSelectMirrorType,
    handleReset,
    loadLevel,
    loadSolution,
    getMirrorsErasedCount,
  }
}

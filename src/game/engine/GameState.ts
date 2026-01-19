import {
  GameState,
  LevelConfig,
  Mirror,
  MirrorType,
  Position,
} from '../types'
import { calculateLaserPath, calculateScore, calculateStars } from './Laser'

export function createInitialGameState(level: LevelConfig): GameState {
  const laserPath = calculateLaserPath(
    level.laserConfig,
    [],
    level.obstacles,
    { width: level.gridWidth, height: level.gridHeight }
  )

  return {
    level,
    placedMirrors: [],
    laserPath,
    selectedMirrorType: '/',
    isComplete: false,
    score: calculateScore(laserPath),
    stars: 0,
  }
}

export function canPlaceMirror(
  state: GameState,
  position: Position
): boolean {
  const { level, placedMirrors } = state

  // Check bounds
  if (
    position.x < 0 ||
    position.x >= level.gridWidth ||
    position.y < 0 ||
    position.y >= level.gridHeight
  ) {
    return false
  }

  // Check if position is laser source
  if (
    position.x === level.laserConfig.x &&
    position.y === level.laserConfig.y
  ) {
    return false
  }

  // Check if position has obstacle
  if (level.obstacles.some((o) => o.x === position.x && o.y === position.y)) {
    return false
  }

  // Check if position already has mirror
  if (
    placedMirrors.some(
      (m) => m.position.x === position.x && m.position.y === position.y
    )
  ) {
    return false
  }

  // Check if player has mirrors left
  if (placedMirrors.length >= level.mirrorsAvailable) {
    return false
  }

  return true
}

export function placeMirror(
  state: GameState,
  position: Position,
  type: MirrorType
): GameState {
  if (!canPlaceMirror(state, position)) {
    return state
  }

  const newMirror: Mirror = { position, type }
  const newMirrors = [...state.placedMirrors, newMirror]

  const laserPath = calculateLaserPath(
    state.level.laserConfig,
    newMirrors,
    state.level.obstacles,
    { width: state.level.gridWidth, height: state.level.gridHeight }
  )

  const score = calculateScore(laserPath)
  const stars = calculateStars(score, state.level.starThresholds)

  return {
    ...state,
    placedMirrors: newMirrors,
    laserPath,
    score,
    stars,
  }
}

export function removeMirror(state: GameState, position: Position): GameState {
  const newMirrors = state.placedMirrors.filter(
    (m) => m.position.x !== position.x || m.position.y !== position.y
  )

  if (newMirrors.length === state.placedMirrors.length) {
    return state
  }

  const laserPath = calculateLaserPath(
    state.level.laserConfig,
    newMirrors,
    state.level.obstacles,
    { width: state.level.gridWidth, height: state.level.gridHeight }
  )

  const score = calculateScore(laserPath)
  const stars = calculateStars(score, state.level.starThresholds)

  return {
    ...state,
    placedMirrors: newMirrors,
    laserPath,
    score,
    stars,
  }
}

export function toggleMirrorType(state: GameState, position: Position): GameState {
  const mirrorIndex = state.placedMirrors.findIndex(
    (m) => m.position.x === position.x && m.position.y === position.y
  )

  if (mirrorIndex === -1) {
    return state
  }

  const newMirrors = [...state.placedMirrors]
  const currentType = newMirrors[mirrorIndex].type
  newMirrors[mirrorIndex] = {
    ...newMirrors[mirrorIndex],
    type: currentType === '/' ? '\\' : '/',
  }

  const laserPath = calculateLaserPath(
    state.level.laserConfig,
    newMirrors,
    state.level.obstacles,
    { width: state.level.gridWidth, height: state.level.gridHeight }
  )

  const score = calculateScore(laserPath)
  const stars = calculateStars(score, state.level.starThresholds)

  return {
    ...state,
    placedMirrors: newMirrors,
    laserPath,
    score,
    stars,
  }
}

export function setSelectedMirrorType(
  state: GameState,
  type: MirrorType
): GameState {
  return {
    ...state,
    selectedMirrorType: type,
  }
}

export function resetGame(state: GameState): GameState {
  return createInitialGameState(state.level)
}

export function completeGame(state: GameState): GameState {
  return {
    ...state,
    isComplete: true,
  }
}

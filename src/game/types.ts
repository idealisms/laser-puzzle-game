export type Direction = 'up' | 'down' | 'left' | 'right'

export type MirrorType = '/' | '\\'

export interface Position {
  x: number
  y: number
}

export interface Mirror {
  position: Position
  type: MirrorType
}

export interface LaserConfig {
  x: number
  y: number
  direction: Direction
}

export interface Obstacle {
  x: number
  y: number
}

export interface LaserSegment {
  start: Position
  end: Position
  direction: Direction
}

export interface LaserPath {
  segments: LaserSegment[]
  totalLength: number
  terminated: boolean
  terminationReason: 'edge' | 'obstacle' | 'loop' | 'max-length'
}

export interface OptimalMirror {
  x: number
  y: number
  type: MirrorType
}

export interface LevelConfig {
  gridWidth: number
  gridHeight: number
  laserConfig: LaserConfig
  obstacles: Obstacle[]
  mirrorsAvailable: number
  optimalScore: number
  optimalSolution?: OptimalMirror[]
}

export interface GameState {
  level: LevelConfig
  placedMirrors: Mirror[]
  laserPath: LaserPath | null
  selectedMirrorType: MirrorType
  isComplete: boolean
  score: number
}

export interface CellState {
  type: 'empty' | 'obstacle' | 'mirror' | 'laser-source'
  mirror?: Mirror
  isLaserPath?: boolean
}

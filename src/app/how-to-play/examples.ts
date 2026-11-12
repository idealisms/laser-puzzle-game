import type { LevelConfig, Mirror, Obstacle } from '@/game/types'

// Small boards for the how-to-play page. They're drawn and scored by the real
// game engine, and examples.test.ts checks that each one shows what its caption says.

export interface Example {
  id: string
  caption: string
  level: LevelConfig
  mirrors: Mirror[]
}

function board(
  width: number,
  height: number,
  laser: { x: number; y: number; direction: 'up' | 'down' | 'left' | 'right' },
  obstacles: Obstacle[] = []
): LevelConfig {
  return {
    gridWidth: width,
    gridHeight: height,
    laserConfig: laser,
    obstacles,
    mirrorsAvailable: 10,
    optimalScore: 0,
  }
}

const m = (x: number, y: number, type: '/' | '\\'): Mirror => ({ position: { x, y }, type })

export const EXAMPLES = {
  mirrors: {
    id: 'mirrors',
    caption: 'Two mirrors turn the beam down, then left, for a longer path.',
    level: board(7, 4, { x: 0, y: 0, direction: 'right' }),
    mirrors: [m(6, 0, '\\'), m(6, 3, '/')],
  },
  walls: {
    id: 'walls',
    caption: 'A wall stops the beam. Steer around it.',
    level: board(7, 4, { x: 0, y: 1, direction: 'right' }, [
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ]),
    mirrors: [m(2, 1, '/'), m(2, 0, '/'), m(5, 0, '\\'), m(5, 3, '/')],
  },
  splitterSplit: {
    id: 'splitter-split',
    caption: 'Into the point: the beam splits in two.',
    level: board(7, 5, { x: 0, y: 2, direction: 'right' }, [{ x: 4, y: 2, type: 'splitter', orientation: 'right' }]),
    mirrors: [],
  },
  splitterTurn: {
    id: 'splitter-turn',
    caption: 'Into a side: the beam turns and leaves through the point.',
    level: board(7, 5, { x: 0, y: 0, direction: 'right' }, [{ x: 4, y: 2, type: 'splitter', orientation: 'right' }]),
    mirrors: [m(4, 0, '\\')],
  },
  gatePass: {
    id: 'gate-pass',
    caption: 'With the arrow: the beam passes through.',
    level: board(7, 3, { x: 0, y: 1, direction: 'right' }, [{ x: 3, y: 1, type: 'gate', orientation: 'right' }]),
    mirrors: [],
  },
  gateBlock: {
    id: 'gate-block',
    caption: 'Against the arrow: the gate is a wall.',
    level: board(7, 3, { x: 0, y: 1, direction: 'right' }, [{ x: 3, y: 1, type: 'gate', orientation: 'left' }]),
    mirrors: [],
  },
  portals: {
    id: 'portals',
    caption: 'The beam enters one portal and leaves its twin, still heading the same way.',
    level: board(
      7,
      5,
      { x: 0, y: 1, direction: 'right' },
      [
        { x: 2, y: 1, type: 'portal', pair: 1 },
        { x: 4, y: 3, type: 'portal', pair: 1 },
        ...[0, 1, 2, 3, 4].map((y) => ({ x: 3, y })),
      ]
    ),
    mirrors: [],
  },
  collision: {
    id: 'collision',
    caption: 'Split beams sent back at each other meet head-on and both stop.',
    level: board(7, 5, { x: 0, y: 2, direction: 'right' }, [{ x: 3, y: 2, type: 'splitter', orientation: 'right' }]),
    mirrors: [m(3, 0, '/'), m(6, 0, '\\'), m(3, 4, '\\'), m(6, 4, '/')],
  },
} satisfies Record<string, Example>

'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Renderer } from '@/game/engine/Renderer'
import { createInitialGameState, loadSolution } from '@/game/engine/GameState'
import { CELL_SIZE, getColors } from '@/game/constants'
import { useSettings } from '@/context/SettingsContext'
import type { Example } from './examples'

// A small, non-interactive board drawn by the game's own renderer.
export function ExampleBoard({ example }: { example: Example }) {
  const { settings } = useSettings()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { level } = example
  const width = level.gridWidth * CELL_SIZE
  const height = level.gridHeight * CELL_SIZE

  const state = useMemo(
    () => loadSolution(createInitialGameState(level), example.mirrors),
    [level, example.mirrors]
  )

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const renderer = new Renderer(ctx, width, height)
    renderer.setColors(getColors(settings.colorblindMode))

    if (!settings.showBlipAnimations) {
      renderer.render(state, null)
      return
    }
    let frameId = 0
    const animate = (timestamp: number) => {
      renderer.render(state, null, false, timestamp / 1000)
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [state, width, height, settings.colorblindMode, settings.showBlipAnimations])

  return (
    <figure className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        role="img"
        aria-label={example.caption}
        data-testid={`example-${example.id}`}
        data-score={state.score}
        className="w-full rounded-md border border-gray-700"
        style={{ maxWidth: width }}
      />
      <figcaption className="text-sm text-gray-400 text-center max-w-xs">
        {example.caption} <span className="text-gray-500">Path length: {state.score}.</span>
      </figcaption>
    </figure>
  )
}

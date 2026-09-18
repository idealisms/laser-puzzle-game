'use client'

import { useState, useEffect, useRef } from 'react'

export type LayoutMode = 'portrait' | 'compact' | 'landscape'

const HEADER_H = 52
export const LANDSCAPE_SIDEBAR_W = 256
export const COMPACT_SIDEBAR_W = 48

export interface GameLayoutState {
  scale: number
  layoutMode: LayoutMode
  containerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Determines layout mode and canvas scale from the viewport dimensions.
 *
 * Layout decision (uses window.innerWidth/Height directly, not container):
 *   landscape — grid is height-limited even after reserving LANDSCAPE_SIDEBAR_W
 *   compact   — grid is height-limited with full width (extra width goes to COMPACT_SIDEBAR_W)
 *   portrait  — grid is width-limited; controls go below
 *
 * The "height-limited" test for a sidebar width S:
 *   (W − S) × (canvasH + border) ≥ (H − HEADER_H) × (canvasW + border)
 */
export function useGameLayout({
  canvasWidth,
  canvasHeight,
  mainPaddingRem = 1.5,
  borderWidth = 2,
}: {
  canvasWidth: number
  canvasHeight: number
  mainPaddingRem?: number
  borderWidth?: number
}): GameLayoutState {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ scale: number; layoutMode: LayoutMode }>({
    scale: 1,
    layoutMode: 'portrait',
  })

  useEffect(() => {
    const bW = canvasWidth + borderWidth * 2
    const bH = canvasHeight + borderWidth * 2

    const update = () => {
      const W = window.innerWidth
      const H = window.innerHeight
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const availH = H - HEADER_H

      let layoutMode: LayoutMode
      let gridW: number
      let padBottom: number

      if ((W - LANDSCAPE_SIDEBAR_W) * bH >= availH * bW) {
        layoutMode = 'landscape'
        gridW = W - LANDSCAPE_SIDEBAR_W
        padBottom = mainPaddingRem * remPx
      } else if (W * bH >= availH * bW) {
        layoutMode = 'compact'
        gridW = W - COMPACT_SIDEBAR_W
        padBottom = 0
      } else {
        layoutMode = 'portrait'
        gridW = W
        padBottom = mainPaddingRem * remPx
      }

      // containerRef.top gives the accurate top after the layout renders (includes any
      // padding from <main>). Falls back to HEADER_H if not yet measured.
      const containerTop = containerRef.current?.getBoundingClientRect().top ?? HEADER_H
      const scale = Math.min(1, gridW / bW, (H - containerTop - padBottom) / bH)

      setState({ scale, layoutMode })
    }

    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', update)
    update()

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [canvasWidth, canvasHeight, mainPaddingRem, borderWidth])

  return { ...state, containerRef }
}

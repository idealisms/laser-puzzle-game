'use client'

import { useState, useEffect, RefObject } from 'react'

export type LayoutMode = 'portrait' | 'landscape'

const FALLBACK_HEADER_H = 52 // used until the header element has been measured
const CONTROLS_W = 300     // fixed width of the landscape controls panel
const CONTROLS_GAP = 24    // gap between grid and controls in landscape (gap-6)
const BORDER_W = 2         // canvas border-width (border-2 on <canvas>)

/**
 * Determines the layout mode and canvas scale from the current viewport.
 *
 * Scale fills the available vertical space (viewport minus the measured header
 * height). Upscaling is allowed so the grid always occupies the full height.
 *
 * Layout decision:
 *   landscape — at least (CONTROLS_W + CONTROLS_GAP) px of horizontal space
 *               remains to the right of the height-scaled grid
 *   portrait  — everything else; scale is additionally capped so the grid
 *               never exceeds the viewport width
 */
export function useGameLayout({
  canvasWidth,
  canvasHeight,
  headerRef,
}: {
  canvasWidth: number
  canvasHeight: number
  headerRef: RefObject<HTMLElement | null>
}) {
  const bW = canvasWidth + BORDER_W * 2   // visual width including border  (604)
  const bH = canvasHeight + BORDER_W * 2  // visual height including border (804)

  const [state, setState] = useState<{ scale: number; layoutMode: LayoutMode }>({
    scale: 1,
    layoutMode: 'portrait',
  })

  useEffect(() => {
    const update = () => {
      const W = window.innerWidth
      const H = window.innerHeight
      const headerH = headerRef.current?.offsetHeight ?? FALLBACK_HEADER_H
      const availH = H - headerH

      // Primary scale: fill the available vertical space (may exceed 1)
      const scaleH = availH / bH
      const gridVisualW = bW * scaleH

      if (W - gridVisualW >= CONTROLS_W + CONTROLS_GAP) {
        // Enough room to the right of the height-scaled grid for controls
        setState({ scale: scaleH, layoutMode: 'landscape' })
      } else {
        // Portrait: also cap so the grid never exceeds viewport width
        const scale = Math.min(scaleH, W / bW)
        setState({ scale, layoutMode: 'portrait' })
      }
    }

    window.addEventListener('resize', update)
    // Re-measure when the header itself changes size (font load, text wrap, etc.)
    const observer = new ResizeObserver(update)
    if (headerRef.current) observer.observe(headerRef.current)
    update()
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [bW, bH, headerRef])

  return state
}

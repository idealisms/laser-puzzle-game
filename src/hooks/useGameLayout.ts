'use client'

import { useState, useEffect, RefObject } from 'react'

export type LayoutMode = 'portrait' | 'landscape'

const FALLBACK_HEADER_H = 52 // used until the header element has been measured
const CONTROLS_W = 260     // fixed width of the landscape controls panel
const CONTROLS_GAP = 24    // gap between grid and controls in landscape (gap-6)
const LANDSCAPE_PAD = 24   // padding around the landscape row (p-6)
const BORDER_W = 2         // canvas border-width (border-2 on <canvas>)

/**
 * Determines the layout mode and canvas scale from the current viewport.
 *
 * Scale fills the available vertical space (viewport minus the measured header
 * height, and minus the top/bottom padding in landscape). Upscaling is allowed
 * so the grid always occupies the full height.
 *
 * Layout decision:
 *   landscape — the row fits horizontally: left padding + height-scaled grid
 *               + CONTROLS_GAP + CONTROLS_W + right padding
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
      // Landscape row has p-6, so the grid loses padding on top and bottom
      const landscapeScale = (availH - LANDSCAPE_PAD * 2) / bH
      const gridVisualW = bW * landscapeScale

      const landscapeW = LANDSCAPE_PAD + gridVisualW + CONTROLS_GAP + CONTROLS_W + LANDSCAPE_PAD

      if (landscapeW <= W) {
        // Enough room for the padded grid + controls row
        setState({ scale: landscapeScale, layoutMode: 'landscape' })
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

'use client'

import { useState, useEffect } from 'react'

export type LayoutMode = 'portrait' | 'compact' | 'landscape'

const HEADER_H = 52
export const LANDSCAPE_SIDEBAR_W = 256
export const COMPACT_SIDEBAR_W = 48
// gap-6 between grid and landscape sidebar
const LANDSCAPE_GAP = 24

export interface GameLayoutState {
  scale: number
  layoutMode: LayoutMode
}

/**
 * Determines layout mode and canvas scale from the viewport dimensions.
 *
 * Layout decision — checks whether the grid would be height-limited at each sidebar width.
 * "Height-limited with sidebar S" means (W − S) × bH ≥ (H − HEADER_H) × bW, i.e. there
 * is spare horizontal space after the grid fills the available height.
 *
 *   landscape — height-limited even after reserving LANDSCAPE_SIDEBAR_W
 *   compact   — height-limited with full width (spare width accommodates COMPACT_SIDEBAR_W)
 *   portrait  — width-limited; controls go below
 *
 * Scale is computed from the actual CSS grid width: window width minus sidebar, main
 * padding (p-6 = 1.5rem each side), and flex gap — so the canvas never overflows its
 * container.
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
  const [state, setState] = useState<GameLayoutState>({ scale: 1, layoutMode: 'portrait' })

  useEffect(() => {
    const bW = canvasWidth + borderWidth * 2
    const bH = canvasHeight + borderWidth * 2

    const update = () => {
      const W = window.innerWidth
      const H = window.innerHeight
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const pad = mainPaddingRem * remPx  // e.g. 24px for p-6
      const availH = H - HEADER_H

      // Layout decision
      let layoutMode: LayoutMode
      if ((W - LANDSCAPE_SIDEBAR_W) * bH >= availH * bW) {
        layoutMode = 'landscape'
      } else if (W * bH >= availH * bW) {
        layoutMode = 'compact'
      } else {
        layoutMode = 'portrait'
      }

      // Grid width: subtract sidebar, main padding (both sides), and flex gap.
      // This matches the actual CSS container width so the canvas never overflows.
      let gridW: number
      let padTop: number
      let padBottom: number

      if (layoutMode === 'landscape') {
        // <main p-6> surrounds a flex-row with gap-6 between grid and sidebar
        gridW = W - LANDSCAPE_SIDEBAR_W - 2 * pad - LANDSCAPE_GAP
        padTop = pad
        padBottom = pad
      } else if (layoutMode === 'compact') {
        // No <main> padding; grid fills width minus the compact strip
        gridW = W - COMPACT_SIDEBAR_W
        padTop = 0
        padBottom = 0
      } else {
        // <main p-6> with no sidebar
        gridW = W - 2 * pad
        padTop = pad
        padBottom = pad
      }

      const scaleW = gridW / bW
      const scaleH = (availH - padTop - padBottom) / bH
      const scale = Math.min(1, scaleW, scaleH)

      setState({ scale, layoutMode })
    }

    window.addEventListener('resize', update)
    update()

    return () => window.removeEventListener('resize', update)
  }, [canvasWidth, canvasHeight, mainPaddingRem, borderWidth])

  return state
}

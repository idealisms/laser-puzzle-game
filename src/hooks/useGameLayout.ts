'use client'

import { useState, useEffect, useRef, RefObject } from 'react'
import { flushSync } from 'react-dom'

export type LayoutMode = 'portrait' | 'landscape'

const FALLBACK_HEADER_H = 52 // used until the header element has been measured
export const CONTROLS_W = 260     // fixed width of the landscape controls panel
export const CONTROLS_GAP = 24    // gap between grid and controls in landscape (gap-6)
export const LANDSCAPE_PAD = 24   // padding around the landscape row (p-6)
export const PORTRAIT_PAD = 16    // padding around the portrait column (p-4)
const BORDER_W = 2         // canvas border-width (border-2 on <canvas>)

/**
 * Determines the layout mode and canvas scale for a given viewport.
 *
 * Scale fills the available vertical space (viewport minus the header height
 * and the layout's top/bottom padding). Upscaling is allowed so the grid
 * always occupies the full height.
 *
 * Layout decision:
 *   landscape — the row fits horizontally: left padding + height-scaled grid
 *               + CONTROLS_GAP + CONTROLS_W + right padding
 *   portrait  — everything else; scale is additionally capped so the grid
 *               never exceeds the viewport width minus left/right padding
 *
 * gridW/gridH are the grid's unscaled visual size, including its border.
 */
export function computeLayout({
  viewportW,
  viewportH,
  headerH,
  gridW,
  gridH,
}: {
  viewportW: number
  viewportH: number
  headerH: number
  gridW: number
  gridH: number
}): { scale: number; layoutMode: LayoutMode } {
  const availH = viewportH - headerH

  // Landscape row has p-6, so the grid loses padding on top and bottom
  const landscapeScale = (availH - LANDSCAPE_PAD * 2) / gridH
  const landscapeW =
    LANDSCAPE_PAD + gridW * landscapeScale + CONTROLS_GAP + CONTROLS_W + LANDSCAPE_PAD

  if (landscapeW <= viewportW) {
    return { scale: landscapeScale, layoutMode: 'landscape' }
  }

  // Portrait column has p-4 on all sides: cap by padded height and width
  const scale = Math.min(
    (availH - PORTRAIT_PAD * 2) / gridH,
    (viewportW - PORTRAIT_PAD * 2) / gridW,
  )
  return { scale, layoutMode: 'portrait' }
}

/**
 * Tracks computeLayout() for the current viewport and measured header height.
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
  // Last measured layout mode; null until the first measurement so the initial
  // placeholder → real layout change on page load isn't animated.
  const modeRef = useRef<LayoutMode | null>(null)

  useEffect(() => {
    const update = () => {
      // Use the layout viewport, not window.inner*: on mobile, when the previous
      // (wider) layout overflows, the browser zooms out and inner* reports the
      // zoomed-out visual viewport, which would lock in an oversized grid.
      const next = computeLayout({
        viewportW: document.documentElement.clientWidth,
        viewportH: document.documentElement.clientHeight,
        headerH: headerRef.current?.offsetHeight ?? FALLBACK_HEADER_H,
        gridW: bW,
        gridH: bH,
      })
      const modeChanged = modeRef.current !== null && modeRef.current !== next.layoutMode
      modeRef.current = next.layoutMode

      // Animate the grid and controls between landscape and portrait with a
      // view transition (see globals.css). Scale-only changes apply directly.
      if (
        modeChanged &&
        document.startViewTransition &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const transition = document.startViewTransition(() => flushSync(() => setState(next)))
        // The browser skips the animation (but still applies the update) if the
        // viewport changes mid-transition, e.g. while drag-resizing a window.
        transition.ready.catch(() => {})
      } else {
        setState(next)
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

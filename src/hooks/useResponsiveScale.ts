'use client'

import { useState, useEffect, useRef } from 'react'

export interface ComputeScaleParams {
  containerWidth: number
  containerTop: number
  windowHeight: number
  canvasWidth: number
  canvasHeight: number
  padding?: number
  mainPaddingRem?: number
  /** CSS border-width on the canvas element in px (default 2 = Tailwind border-2) */
  borderWidth?: number
  /** Resolved px size of 1rem (default 16) */
  remPx?: number
}

/**
 * Pure scale calculation — exported for unit testing.
 *
 * The visual canvas is (canvasWidth + borderWidth*2) × (canvasHeight + borderWidth*2)
 * after CSS border is applied. The scale must be chosen so that visual size fits within
 * the container without overflow, which means dividing available space by the total
 * visual dimension (content + border), not just the content dimension.
 */
export function computeScale({
  containerWidth,
  containerTop,
  windowHeight,
  canvasWidth,
  canvasHeight,
  padding = 0,
  mainPaddingRem = 1.5,
  borderWidth = 2,
  remPx = 16,
}: ComputeScaleParams): number {
  const borderTotal = borderWidth * 2
  const availableWidth = containerWidth - padding
  // mainPaddingRem accounts for bottom padding of the containing <main>; no separate
  // border term because the visual height is (canvasHeight + borderTotal) below.
  const availableHeight = windowHeight - containerTop - padding - mainPaddingRem * remPx

  const widthScale = availableWidth / (canvasWidth + borderTotal)
  const heightScale = availableHeight / (canvasHeight + borderTotal)
  return Math.min(1, widthScale, heightScale)
}

interface UseResponsiveScaleProps {
  canvasWidth: number
  canvasHeight: number
  padding?: number
  mainPaddingRem?: number
  borderWidth?: number
}

export function useResponsiveScale({
  canvasWidth,
  canvasHeight,
  padding = 0,
  mainPaddingRem = 1.5,
  borderWidth = 2,
}: UseResponsiveScaleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const scale = computeScale({
        containerWidth: container.clientWidth,
        containerTop: container.getBoundingClientRect().top,
        windowHeight: window.innerHeight,
        canvasWidth,
        canvasHeight,
        padding,
        mainPaddingRem,
        borderWidth,
        remPx,
      })
      setScale(scale)
    }

    const resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(container)
    window.addEventListener('resize', updateScale)

    updateScale()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [canvasWidth, canvasHeight, padding, mainPaddingRem, borderWidth])

  return { scale, containerRef }
}

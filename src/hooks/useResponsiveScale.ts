'use client'

import { useState, useEffect, useRef } from 'react'

interface UseResponsiveScaleProps {
  canvasWidth: number
  canvasHeight: number
  padding?: number
}

export function useResponsiveScale({ canvasWidth, canvasHeight, padding = 0 }: UseResponsiveScaleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const availableWidth = container.clientWidth - padding
      const containerTop = container.getBoundingClientRect().top
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const bottomPadding = 4 + 1.5 * remPx // 4px border + p-6 (1.5rem) from <main>
      const availableHeight = window.innerHeight - containerTop - padding - bottomPadding

      const widthScale = availableWidth / canvasWidth
      const heightScale = availableHeight / canvasHeight
      const scale = Math.min(1, widthScale, heightScale)

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
  }, [canvasWidth, canvasHeight, padding])

  return { scale, containerRef }
}

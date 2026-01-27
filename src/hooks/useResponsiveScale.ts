'use client'

import { useState, useEffect, useRef } from 'react'

interface UseResponsiveScaleProps {
  canvasWidth: number
  padding?: number
}

export function useResponsiveScale({ canvasWidth, padding = 0 }: UseResponsiveScaleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const containerWidth = container.clientWidth
      const availableWidth = containerWidth - padding
      const newScale = Math.min(1, availableWidth / canvasWidth)
      setScale(newScale)
    }

    const resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(container)

    // Initial calculation
    updateScale()

    return () => {
      resizeObserver.disconnect()
    }
  }, [canvasWidth, padding])

  return { scale, containerRef }
}

'use client'

import { useState, useEffect } from 'react'
import { getLocalDateString } from '@/lib/date'
import { GameView } from '@/components/game/GameView'

export default function HomePage() {
  const [date, setDate] = useState(getLocalDateString)

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const today = getLocalDateString()
        setDate((current) => (current !== today ? today : current))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return <GameView key={date} date={date} enableLevelCache />
}

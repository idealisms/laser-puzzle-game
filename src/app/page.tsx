'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getLocalDateString } from '@/lib/date'
import { GameView } from '@/components/game/GameView'

export default function HomePage() {
  const router = useRouter()
  const [date, setDate] = useState(getLocalDateString)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_MODE === 'pack') {
      router.replace('/game')
      return
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const today = getLocalDateString()
        setDate((current) => (current !== today ? today : current))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [router])

  if (process.env.NEXT_PUBLIC_APP_MODE === 'pack') {
    return null
  }

  return <GameView key={date} date={date} enableLevelCache />
}

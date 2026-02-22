'use client'

import { getLocalDateString } from '@/lib/date'
import { GameView } from '@/components/game/GameView'

export default function HomePage() {
  return <GameView date={getLocalDateString()} />
}

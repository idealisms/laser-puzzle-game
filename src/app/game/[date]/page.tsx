'use client'

import { useParams } from 'next/navigation'
import { GameView } from '@/components/game/GameView'

export default function GamePage() {
  const params = useParams()
  const date = params.date as string

  return <GameView date={date} />
}

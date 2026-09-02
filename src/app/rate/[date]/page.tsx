'use client'

import { useParams } from 'next/navigation'
import { RatingGameView } from '@/components/game/RatingGameView'

export default function RateDatePage() {
  const params = useParams()
  return <RatingGameView date={params.date as string} />
}

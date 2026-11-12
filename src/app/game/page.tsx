import type { Metadata } from 'next'
import { PastPuzzles } from './PastPuzzles'

export const metadata: Metadata = {
  title: 'Past Puzzles',
  description: 'Every past Laser Puzzle, with your scores. Play any day you missed.',
  alternates: { canonical: '/game' },
}

export default function PastPuzzlesPage() {
  return <PastPuzzles />
}

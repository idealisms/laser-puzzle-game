import type { Metadata } from 'next'
import { GameView } from '@/components/game/GameView'
import { describeFeatures, getReleasedPuzzle, puzzleHeading } from '@/lib/puzzleInfo'

interface Props {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params
  const puzzle = await getReleasedPuzzle(date)

  // Not released yet, or no such puzzle: say nothing about it, and keep it out of search.
  if (!puzzle) {
    return { robots: { index: false } }
  }

  const heading = puzzleHeading(date)
  const title = `Laser Puzzle – ${heading}`
  const description = `The Laser Puzzle for ${heading}. Place ${describeFeatures(puzzle.level)} to bend the laser into the longest path you can. Free, no sign-up.`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/game/${date}` },
    openGraph: { title, description, url: `/game/${date}` },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function GamePage({ params }: Props) {
  const { date } = await params
  return <GameView date={date} />
}

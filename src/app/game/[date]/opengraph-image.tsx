import { ImageResponse } from 'next/og'
import { OgCard, OG_SIZE } from '@/app/og'
import { SITE_EXAMPLE_LEVEL } from '@/app/opengraph-image'
import { describeFeatures, formatPuzzleDate, getReleasedPuzzle } from '@/lib/puzzleInfo'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'The day’s Laser Puzzle board'

// The day's board as the player first sees it (no mirrors, so no spoilers).
export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const puzzle = await getReleasedPuzzle(date)

  if (!puzzle) {
    // Unreleased or missing: a generic card that gives nothing away.
    return new ImageResponse(
      <OgCard level={SITE_EXAMPLE_LEVEL.level} mirrors={SITE_EXAMPLE_LEVEL.mirrors} kicker="Laser Puzzle" title="A daily mirror puzzle" lines={['Bend the laser into the longest path you can.']} />,
      size
    )
  }

  return new ImageResponse(
    <OgCard
      level={puzzle.level}
      kicker={`Laser Puzzle · ${formatPuzzleDate(date)}`}
      title={puzzle.name ?? formatPuzzleDate(date)}
      lines={[`${describeFeatures(puzzle.level)}.`, 'How long can you make the laser?']}
    />,
    size
  )
}

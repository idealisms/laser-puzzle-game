import { ImageResponse } from 'next/og'
import { OgCard, OG_SIZE } from './og'
import { EXAMPLES } from './how-to-play/examples'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'Laser Puzzle: a laser bent around walls by mirrors'

// Used by every page without its own preview image.
export const SITE_EXAMPLE_LEVEL = EXAMPLES.walls

export default function Image() {
  return new ImageResponse(
    <OgCard
      level={SITE_EXAMPLE_LEVEL.level}
      mirrors={SITE_EXAMPLE_LEVEL.mirrors}
      kicker="Laser Puzzle"
      title="A free daily mirror puzzle"
      lines={['Place mirrors to bend the laser into the longest path you can.', 'A new puzzle every day.']}
    />,
    size
  )
}

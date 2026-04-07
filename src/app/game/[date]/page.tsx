import packConfig from '../../../../puzzle-packs/pack.json'
import { GameView } from '@/components/game/GameView'

/**
 * Used only during `npm run build:pack` (output: 'export').
 * Tells Next.js which date slugs to pre-render as static pages.
 * Ignored in regular web builds.
 */
export function generateStaticParams() {
  return (packConfig.puzzles as string[]).map((date) => ({ date }))
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  return <GameView date={date} />
}

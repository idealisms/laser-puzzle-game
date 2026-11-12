import type { Achievement } from './achievements'

interface ShareTextOptions {
  date: string // YYYY-MM-DD
  percentage: number
  achievements: Achievement[]
  siteUrl: string
  // Off for players who don't want a link preview in chat.
  includeLink: boolean
}

/**
 * Laser Puzzle 2026/11/11
 * 90% 💯🔥
 * https://laserpuzzle.ponderer.org/game/2026-11-11
 */
export function buildShareText({ date, percentage, achievements, siteUrl, includeLink }: ShareTextOptions): string {
  const emoji = achievements.length > 0 ? ` ${achievements.map((a) => a.emoji).join('')}` : ''
  const lines = [`Laser Puzzle ${date.replace(/-/g, '/')}`, `${percentage}%${emoji}`]
  if (includeLink) lines.push(new URL(`/game/${date}`, siteUrl).toString())
  return lines.join('\n')
}

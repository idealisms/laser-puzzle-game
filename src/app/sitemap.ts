import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { latestReleasedDate } from '@/lib/puzzleInfo'
import { SITE_URL } from '@/lib/siteConfig'

// Built on request, not at build time: it lists every released puzzle, and the
// list grows each day.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/how-to-play`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/game`, changeFrequency: 'daily', priority: 0.6 },
  ]

  try {
    const levels = await prisma.level.findMany({
      where: { date: { lte: latestReleasedDate() } },
      select: { date: true },
      orderBy: { date: 'desc' },
    })
    for (const { date } of levels) {
      pages.push({ url: `${SITE_URL}/game/${date}`, lastModified: date, changeFrequency: 'yearly', priority: 0.5 })
    }
  } catch (e) {
    // Still serve the main pages if the database is unavailable.
    console.error('sitemap: could not list puzzles', e)
  }

  return pages
}

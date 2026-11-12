import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/siteConfig'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/how-to-play`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/game`, changeFrequency: 'daily', priority: 0.6 },
  ]
}

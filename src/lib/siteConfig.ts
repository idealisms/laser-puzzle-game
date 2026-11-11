// Where the site lives, and the old hosts that should send players there.
// Both are set at build time in next.config.ts (per Vercel environment).

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://laserpuzzle.ponderer.org'

// Hosts (with port, if any) that serve only the "we've moved" redirect page.
export const MIGRATE_FROM_HOSTS = (process.env.NEXT_PUBLIC_MIGRATE_FROM_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

export function isOldHost(host: string): boolean {
  return MIGRATE_FROM_HOSTS.includes(host)
}

// Host shown in share text, e.g. "laserpuzzle.ponderer.org".
export const SITE_HOST = new URL(SITE_URL).host

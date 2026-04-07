import { LevelConfig } from '@/game/types'

/**
 * Returns true when running as the itch.io puzzle pack build.
 * Uses a function-level check (not a module-level constant) so that
 * Jest tests can set process.env.NEXT_PUBLIC_APP_MODE per-test.
 */
export function isPackMode(): boolean {
  return process.env.NEXT_PUBLIC_APP_MODE === 'pack'
}

/**
 * Returns the URL to fetch a level by date.
 * Pack mode: static JSON file served from /puzzles/
 * Daily mode: REST API endpoint
 */
export function getLevelFetchUrl(date: string): string {
  return isPackMode() ? `/puzzles/${date}.json` : `/api/levels/${date}`
}

/**
 * Parses the fetch response into a LevelConfig.
 * Pack mode: the static JSON is the LevelConfig directly.
 * Daily mode: the API wraps it as { level: LevelConfig }.
 */
export function parseLevelResponse(data: unknown): LevelConfig {
  if (isPackMode()) {
    return data as LevelConfig
  }
  return (data as { level: LevelConfig }).level
}

/**
 * Returns the URL to fetch the list of available puzzles.
 * Pack mode: static index from /puzzles/index.json
 * Daily mode: REST API calendar endpoint
 */
export function getCalendarFetchUrl(): string {
  return isPackMode() ? '/puzzles/index.json' : '/api/levels/calendar'
}

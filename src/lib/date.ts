/**
 * Gets today's date in YYYY-MM-DD format using the user's local timezone.
 * This ensures users see puzzles based on their local date, not UTC.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

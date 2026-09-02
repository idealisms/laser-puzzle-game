/**
 * Tracks foreground (visible-tab) time for a session, so backgrounded time
 * isn't counted toward "time spent." Framework-agnostic and clock-injectable
 * so it can be unit tested without touching the DOM or wall-clock time.
 */
export interface ForegroundTimer {
  /** Call whenever document.visibilityState changes. */
  onVisibilityChange(isVisible: boolean): void
  /** Total foreground time elapsed so far, in whole seconds. */
  getElapsedSeconds(): number
}

export function createForegroundTimer(
  initiallyVisible: boolean,
  now: () => number = Date.now
): ForegroundTimer {
  let activeMs = 0
  let visibleSince: number | null = initiallyVisible ? now() : null

  return {
    onVisibilityChange(isVisible: boolean) {
      if (isVisible) {
        if (visibleSince === null) visibleSince = now()
      } else if (visibleSince !== null) {
        activeMs += now() - visibleSince
        visibleSince = null
      }
    },
    getElapsedSeconds() {
      const openMs = visibleSince !== null ? now() - visibleSince : 0
      return Math.round((activeMs + openMs) / 1000)
    },
  }
}

/**
 * Tracks foreground (visible-tab) time for a session, so backgrounded time
 * isn't counted toward "time spent." Counting begins at start() (e.g. the first
 * mirror placed), not at creation. Framework-agnostic and clock-injectable
 * so it can be unit tested without touching the DOM or wall-clock time.
 */
export interface ForegroundTimer {
  /** Begin counting foreground time. Calls after the first are ignored. */
  start(): void
  /** Call whenever document.visibilityState changes, before or after start(). */
  onVisibilityChange(isVisible: boolean): void
  /** Total foreground time elapsed since start(), in whole seconds. */
  getElapsedSeconds(): number
}

export function createForegroundTimer(
  initiallyVisible: boolean,
  now: () => number = Date.now
): ForegroundTimer {
  let visible = initiallyVisible
  let started = false
  let activeMs = 0
  let visibleSince: number | null = null

  return {
    start() {
      if (started) return
      started = true
      if (visible) visibleSince = now()
    },
    onVisibilityChange(isVisible: boolean) {
      visible = isVisible
      if (!started) return
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

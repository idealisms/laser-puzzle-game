import { createForegroundTimer } from './foregroundTimer'

function fakeClock(startMs = 0) {
  let t = startMs
  return {
    now: () => t,
    advance: (ms: number) => { t += ms },
  }
}

describe('createForegroundTimer', () => {
  it('accumulates elapsed time while visible', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)
    timer.start()

    clock.advance(5000)
    expect(timer.getElapsedSeconds()).toBe(5)
  })

  it('freezes elapsed time while hidden', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)
    timer.start()

    clock.advance(5000)
    timer.onVisibilityChange(false)
    clock.advance(10000) // tab backgrounded — should not count
    expect(timer.getElapsedSeconds()).toBe(5)
  })

  it('resumes accumulating after becoming visible again', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)
    timer.start()

    clock.advance(5000)
    timer.onVisibilityChange(false)
    clock.advance(10000)
    timer.onVisibilityChange(true)
    clock.advance(3000)
    expect(timer.getElapsedSeconds()).toBe(8)
  })

  it('does not count time before the tab first becomes visible', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(false, clock.now)
    timer.start()

    clock.advance(10000) // starts hidden — should not count
    timer.onVisibilityChange(true)
    clock.advance(4000)
    expect(timer.getElapsedSeconds()).toBe(4)
  })

  it('sums multiple visible/hidden cycles correctly', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)
    timer.start()

    clock.advance(2000)
    timer.onVisibilityChange(false)
    clock.advance(1000)
    timer.onVisibilityChange(true)
    clock.advance(2000)
    timer.onVisibilityChange(false)
    clock.advance(9999)
    timer.onVisibilityChange(true)
    clock.advance(1000)

    expect(timer.getElapsedSeconds()).toBe(5) // 2s + 2s + 1s
  })

  it('is idempotent when the same visibility state repeats', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)
    timer.start()

    clock.advance(2000)
    timer.onVisibilityChange(true) // redundant "visible" event
    clock.advance(3000)
    expect(timer.getElapsedSeconds()).toBe(5)

    timer.onVisibilityChange(false)
    timer.onVisibilityChange(false) // redundant "hidden" event
    clock.advance(10000)
    expect(timer.getElapsedSeconds()).toBe(5)
  })

  it('rounds to the nearest second', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)
    timer.start()

    clock.advance(2499)
    expect(timer.getElapsedSeconds()).toBe(2)

    clock.advance(1) // total 2500ms
    expect(timer.getElapsedSeconds()).toBe(3)
  })

  it('reports zero when never visible', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(false, clock.now)
    timer.start()

    clock.advance(5000)
    expect(timer.getElapsedSeconds()).toBe(0)
  })

  it('does not count time before start()', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)

    clock.advance(30000) // page open, no mirror placed yet
    expect(timer.getElapsedSeconds()).toBe(0)

    timer.start()
    clock.advance(4000)
    expect(timer.getElapsedSeconds()).toBe(4)
  })

  it('ignores repeated start() calls', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)
    timer.start()

    clock.advance(5000)
    timer.start() // must not reset the clock
    clock.advance(2000)
    expect(timer.getElapsedSeconds()).toBe(7)
  })

  it('tracks visibility changes that happen before start()', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)

    timer.onVisibilityChange(false)
    clock.advance(10000)
    timer.start() // started while hidden — nothing counts yet
    clock.advance(10000)
    expect(timer.getElapsedSeconds()).toBe(0)

    timer.onVisibilityChange(true)
    clock.advance(3000)
    expect(timer.getElapsedSeconds()).toBe(3)
  })

  it('counts from start() when the page became visible before it', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(false, clock.now)

    clock.advance(5000)
    timer.onVisibilityChange(true)
    clock.advance(5000) // visible but no mirror yet
    timer.start()
    clock.advance(2000)
    expect(timer.getElapsedSeconds()).toBe(2)
  })
})

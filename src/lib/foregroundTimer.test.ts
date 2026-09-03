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

    clock.advance(5000)
    expect(timer.getElapsedSeconds()).toBe(5)
  })

  it('freezes elapsed time while hidden', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)

    clock.advance(5000)
    timer.onVisibilityChange(false)
    clock.advance(10000) // tab backgrounded — should not count
    expect(timer.getElapsedSeconds()).toBe(5)
  })

  it('resumes accumulating after becoming visible again', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)

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

    clock.advance(10000) // starts hidden — should not count
    timer.onVisibilityChange(true)
    clock.advance(4000)
    expect(timer.getElapsedSeconds()).toBe(4)
  })

  it('sums multiple visible/hidden cycles correctly', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(true, clock.now)

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

    clock.advance(2499)
    expect(timer.getElapsedSeconds()).toBe(2)

    clock.advance(1) // total 2500ms
    expect(timer.getElapsedSeconds()).toBe(3)
  })

  it('reports zero when never visible', () => {
    const clock = fakeClock()
    const timer = createForegroundTimer(false, clock.now)

    clock.advance(5000)
    expect(timer.getElapsedSeconds()).toBe(0)
  })
})

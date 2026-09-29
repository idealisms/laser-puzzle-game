import {
  computeLayout,
  CONTROLS_W,
  CONTROLS_GAP,
  LANDSCAPE_PAD,
  PORTRAIT_PAD,
} from '../useGameLayout'

// Default 15x20 grid at 40px cells plus a 2px border on each side
const GRID_W = 604
const GRID_H = 804

function layout(viewportW: number, viewportH: number, headerH = 52) {
  return computeLayout({ viewportW, viewportH, headerH, gridW: GRID_W, gridH: GRID_H })
}

describe('computeLayout', () => {
  describe('landscape', () => {
    it('fills the height between the header and the top/bottom padding', () => {
      // 904 - 52 header - 2*24 padding = 804 → scale 1
      expect(layout(1200, 904)).toEqual({ scale: 1, layoutMode: 'landscape' })
    })

    it('uses the measured header height', () => {
      // 913 - 61 header - 2*24 padding = 804 → scale 1
      expect(layout(1200, 913, 61)).toEqual({ scale: 1, layoutMode: 'landscape' })
      expect(layout(1200, 904, 61).scale).toBeCloseTo(795 / GRID_H)
    })

    it('upscales beyond 1 when there is room', () => {
      // 1708 - 52 - 48 = 1608 = 2 * 804
      expect(layout(1600, 1708)).toEqual({ scale: 2, layoutMode: 'landscape' })
    })
  })

  describe('landscape/portrait breakpoint', () => {
    // At scale 1: 24 + 604 + 24 + 260 + 24 = 936
    const breakpoint = LANDSCAPE_PAD + GRID_W + CONTROLS_GAP + CONTROLS_W + LANDSCAPE_PAD

    it('is 936px wide for an unscaled grid', () => {
      expect(breakpoint).toBe(936)
    })

    it('uses landscape when the padded row exactly fits', () => {
      expect(layout(breakpoint, 904).layoutMode).toBe('landscape')
    })

    it('uses portrait when the padded row is 1px too wide', () => {
      expect(layout(breakpoint - 1, 904).layoutMode).toBe('portrait')
    })
  })

  describe('portrait', () => {
    it('is capped by the padded height when height is the constraint', () => {
      // height: (904 - 52 - 32) / 804 = 820/804; width: (935 - 32) / 604 ≈ 1.5
      expect(layout(935, 904)).toEqual({ scale: 820 / GRID_H, layoutMode: 'portrait' })
    })

    it('is capped by the padded width when width is the constraint', () => {
      // width: (400 - 32) / 604 → grid is exactly 368px wide
      const { scale, layoutMode } = layout(400, 900)
      expect(layoutMode).toBe('portrait')
      expect(scale).toBe((400 - PORTRAIT_PAD * 2) / GRID_W)
      expect(GRID_W * scale).toBeCloseTo(368)
    })

    it('never exceeds the viewport minus padding in either dimension', () => {
      for (const [w, h] of [[320, 568], [375, 667], [414, 896], [600, 900], [768, 1024]]) {
        const { scale, layoutMode } = layout(w, h)
        expect(layoutMode).toBe('portrait')
        expect(GRID_W * scale).toBeLessThanOrEqual(w - PORTRAIT_PAD * 2 + 1e-9)
        expect(GRID_H * scale).toBeLessThanOrEqual(h - 52 - PORTRAIT_PAD * 2 + 1e-9)
      }
    })
  })
})

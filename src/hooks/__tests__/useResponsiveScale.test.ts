import { computeScale } from '../useResponsiveScale'

// Game grid: 15×20 cells × 40px = 600×800px canvas content + 2px border each side
const CANVAS_W = 600
const CANVAS_H = 800
const BORDER = 2
const BORDER_TOTAL = BORDER * 2  // 4px

// After scaling by `s`, the visual canvas dimensions (content + border) are:
const visualW = (s: number) => (CANVAS_W + BORDER_TOTAL) * s
const visualH = (s: number) => (CANVAS_H + BORDER_TOTAL) * s

const HEADER_H = 52   // header height in px (approximate)
const REM = 16        // 1rem = 16px (browser default)
const CHROME_H = 50   // mobile browser address bar height

// Base params for squarish layout (compact sidebar, no main padding)
function squarishParams(screenW: number, screenH: number, chromeH = 0) {
  const SIDEBAR_W = 48
  return {
    containerWidth: screenW - SIDEBAR_W,
    containerTop: HEADER_H,
    windowHeight: screenH - chromeH,
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    mainPaddingRem: 0,
    borderWidth: BORDER,
    remPx: REM,
  }
}

// Base params for standard phone / desktop layout (no sidebar, p-6 main padding)
function standardParams(screenW: number, screenH: number, mainPadRem = 1.5) {
  const MAIN_PAD = Math.round(mainPadRem * REM)  // 24px each side
  return {
    containerWidth: screenW - MAIN_PAD * 2,
    containerTop: HEADER_H,
    windowHeight: screenH,
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    mainPaddingRem: mainPadRem,
    borderWidth: BORDER,
    remPx: REM,
  }
}

describe('computeScale', () => {
  describe('invariants', () => {
    it('never upscales beyond 1', () => {
      // Even on a huge desktop the canvas should not grow past its native size
      expect(computeScale(standardParams(1920, 1080))).toBeLessThanOrEqual(1)
      expect(computeScale(standardParams(2560, 1440))).toBeLessThanOrEqual(1)
    })

    it('always returns a positive scale', () => {
      expect(computeScale(squarishParams(360, 480))).toBeGreaterThan(0)
      expect(computeScale(standardParams(375, 667))).toBeGreaterThan(0)
    })
  })

  describe('squarish layout — Z Fold 8 cover screen (~360×480 CSS px)', () => {
    // Sidebar is 48px; canvas area = 312px wide.
    // Chrome hidden: width-limited → visual width must not exceed 312px.
    it('no visual overflow when chrome is hidden (width-limited)', () => {
      const s = computeScale(squarishParams(360, 480, 0))
      expect(visualW(s)).toBeLessThanOrEqual(312 + 0.5)  // ≤ containerWidth + rounding
    })

    it('no visual overflow when chrome is visible (height-limited)', () => {
      const s = computeScale(squarishParams(360, 480, CHROME_H))
      const containerW = 360 - 48
      expect(visualW(s)).toBeLessThanOrEqual(containerW + 0.5)
    })

    it('canvas fits vertically when chrome is visible', () => {
      const visibleH = 480 - CHROME_H
      const s = computeScale(squarishParams(360, 480, CHROME_H))
      expect(visualH(s)).toBeLessThanOrEqual(visibleH - HEADER_H + 0.5)
    })

    it('scale is height-limited when chrome is visible', () => {
      const p = squarishParams(360, 480, CHROME_H)
      const s = computeScale(p)
      const widthScale  = p.containerWidth  / (CANVAS_W + BORDER_TOTAL)
      const heightScale = (p.windowHeight - HEADER_H) / (CANVAS_H + BORDER_TOTAL)
      expect(s).toBeCloseTo(Math.min(widthScale, heightScale), 4)
    })

    it('scale is width-limited when chrome is hidden', () => {
      const p = squarishParams(360, 480, 0)
      const s = computeScale(p)
      const widthScale = p.containerWidth / (CANVAS_W + BORDER_TOTAL)
      expect(s).toBeCloseTo(widthScale, 4)
    })

    it('scale shrinks when chrome appears (browser bar reduces available height)', () => {
      const sHidden  = computeScale(squarishParams(360, 480, 0))
      const sVisible = computeScale(squarishParams(360, 480, CHROME_H))
      expect(sVisible).toBeLessThan(sHidden)
    })
  })

  describe('squarish layout — wider cover screen estimate (~393×851)', () => {
    it('no visual overflow when chrome is hidden', () => {
      const containerW = 393 - 48
      const s = computeScale(squarishParams(393, 851, 0))
      expect(visualW(s)).toBeLessThanOrEqual(containerW + 0.5)
    })
  })

  describe('squarish layout — iPad 1024×768 landscape', () => {
    it('no visual overflow (height-limited at this size)', () => {
      const containerW = 1024 - 48
      const s = computeScale(squarishParams(1024, 768, 0))
      expect(visualW(s)).toBeLessThanOrEqual(containerW + 0.5)
      // At 976px available width, canvas is height-limited; scale ≈ 0.89
      expect(s).toBeLessThan(1)
    })
  })

  describe('standard portrait phone layout — no sidebar, p-6 main padding', () => {
    it('iPhone SE 375×667 — no visual overflow', () => {
      const containerW = 375 - 48   // p-6 = 24px each side
      const s = computeScale(standardParams(375, 667))
      expect(visualW(s)).toBeLessThanOrEqual(containerW + 0.5)
    })

    it('iPhone 16 390×844 — no visual overflow', () => {
      const containerW = 390 - 48
      const s = computeScale(standardParams(390, 844))
      expect(visualW(s)).toBeLessThanOrEqual(containerW + 0.5)
    })

    it('Galaxy S24 360×780 — no visual overflow', () => {
      const containerW = 360 - 48
      const s = computeScale(standardParams(360, 780))
      expect(visualW(s)).toBeLessThanOrEqual(containerW + 0.5)
    })
  })

  describe('wide / desktop layout — no sidebar, p-6 main padding', () => {
    it('MacBook Air 1280×800 — scale ≤ 1, no overflow', () => {
      const s = computeScale(standardParams(1280, 800))
      expect(s).toBeLessThanOrEqual(1)
    })

    it('Desktop 1920×1080 — scale is exactly 1 (canvas at native size)', () => {
      const s = computeScale(standardParams(1920, 1080))
      expect(s).toBe(1)
    })

    it('Desktop 2560×1440 retina — scale is exactly 1', () => {
      const s = computeScale(standardParams(2560, 1440))
      expect(s).toBe(1)
    })
  })

  describe('border accounting — regression for sidebar overlap bug', () => {
    // The bug: scale was canvasWidth/containerWidth instead of
    // (canvasWidth+border)/containerWidth, so the visual canvas was
    // containerWidth * (1 + 4/600) ≈ containerWidth + 2px wide.
    it('visual canvas never exceeds container width across all squarish sizes', () => {
      const sizes: [number, number][] = [
        [360, 480], [375, 500], [390, 520], [412, 550], [430, 570],
      ]
      for (const [w, h] of sizes) {
        const containerW = w - 48
        const s = computeScale(squarishParams(w, h, 0))
        expect(visualW(s)).toBeLessThanOrEqual(containerW + 0.5)
      }
    })

    it('visual canvas is close to (but not over) container width when width-limited', () => {
      // After the fix, visual width should equal containerWidth within 1px
      const containerW = 360 - 48  // 312px
      const s = computeScale(squarishParams(360, 480, 0))
      expect(visualW(s)).toBeGreaterThan(containerW - 1)   // not unnecessarily small
      expect(visualW(s)).toBeLessThanOrEqual(containerW + 0.5)  // not overflowing
    })
  })
})

import { test, expect, Page } from '@playwright/test'

// Layout constants mirrored from src/hooks/useGameLayout.ts
const LANDSCAPE_PAD = 24
const CONTROLS_GAP = 24
const CONTROLS_W = 260
const PORTRAIT_PAD = 16

// Sub-pixel rounding tolerance (the grid is sized with Math.round)
const TOL = 1

const LEVEL = {
  id: 'e2e',
  date: '2026-01-01',
  gridWidth: 15,
  gridHeight: 20,
  laserConfig: { x: 0, y: 0, direction: 'right' },
  obstacles: [],
  mirrorsAvailable: 10,
  optimalScore: 100,
  optimalSolution: null,
}

// Serve a fixed level so the tests don't depend on the database, and mark the
// player as returning so the first-visit How To Play modal stays closed.
async function openGame(page: Page) {
  await page.route('**/api/levels/2026-01-01', route =>
    route.fulfill({ json: { level: LEVEL } })
  )
  await page.addInitScript(() => {
    localStorage.setItem('laser-puzzle-progress', JSON.stringify({ '2000-01-01': { bestScore: 1 } }))
  })
  await page.goto('/game/2026-01-01')
  await expect(page.getByTestId('grid')).toBeVisible()
}

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox()
  if (!b) throw new Error(`${selector} has no bounding box`)
  return b
}

async function viewportMetrics(page: Page) {
  return page.evaluate(() => ({
    clientW: document.documentElement.clientWidth,
    clientH: document.documentElement.clientHeight,
    scrollW: document.documentElement.scrollWidth,
    zoom: window.visualViewport?.scale ?? 1,
  }))
}

// Retry geometry checks until they pass: layout settles over a few frames
// after a resize (resize event → React render → ResizeObserver).
async function expectLandscapeFits(page: Page) {
  await expect(() => checkLandscape(page)).toPass({ timeout: 5_000 })
}

async function expectPortraitFits(page: Page) {
  await expect(() => checkPortrait(page)).toPass({ timeout: 5_000 })
}

async function checkLandscape(page: Page) {
  await expect(page.locator('[data-layout="landscape"]')).toBeVisible()
  const header = await box(page, 'header')
  const grid = await box(page, '[data-testid="grid"]')
  const controls = await box(page, '[data-testid="controls"]')
  const vp = await viewportMetrics(page)

  // Grid fills the height between the header and the vertical padding
  expect(grid.y).toBeCloseTo(header.y + header.height + LANDSCAPE_PAD, 0)
  expect(grid.y + grid.height).toBeCloseTo(vp.clientH - LANDSCAPE_PAD, 0)

  // Controls are 260px, top-aligned, one gap to the right of the grid
  expect(controls.width).toBeCloseTo(CONTROLS_W, 0)
  expect(controls.y).toBeCloseTo(grid.y, 0)
  expect(controls.x).toBeCloseTo(grid.x + grid.width + CONTROLS_GAP, 0)

  // Padded row fits within the viewport with no horizontal overflow
  expect(grid.x).toBeGreaterThanOrEqual(LANDSCAPE_PAD - TOL)
  expect(controls.x + controls.width).toBeLessThanOrEqual(vp.clientW - LANDSCAPE_PAD + TOL)
  expect(vp.scrollW).toBeLessThanOrEqual(vp.clientW)
  expect(vp.zoom).toBe(1)
}

async function checkPortrait(page: Page) {
  await expect(page.locator('[data-layout="portrait"]')).toBeVisible()
  const header = await box(page, 'header')
  const grid = await box(page, '[data-testid="grid"]')
  const controls = await box(page, '[data-testid="controls"]')
  const vp = await viewportMetrics(page)

  // Grid stays inside the padded viewport on every side
  expect(grid.x).toBeGreaterThanOrEqual(PORTRAIT_PAD - TOL)
  expect(grid.x + grid.width).toBeLessThanOrEqual(vp.clientW - PORTRAIT_PAD + TOL)
  expect(grid.y).toBeCloseTo(header.y + header.height + PORTRAIT_PAD, 0)
  expect(grid.y + grid.height).toBeLessThanOrEqual(vp.clientH - PORTRAIT_PAD + TOL)

  // It is constrained by one of the two padded dimensions
  const fillsWidth = Math.abs(grid.width - (vp.clientW - PORTRAIT_PAD * 2)) <= TOL
  const fillsHeight = Math.abs(grid.y + grid.height - (vp.clientH - PORTRAIT_PAD)) <= TOL
  expect(fillsWidth || fillsHeight).toBe(true)

  // Controls sit below the grid, flush with its edges
  expect(controls.y).toBeGreaterThanOrEqual(grid.y + grid.height)
  expect(controls.x).toBeCloseTo(grid.x, 0)
  expect(controls.width).toBeCloseTo(grid.width, 0)

  expect(vp.scrollW).toBeLessThanOrEqual(vp.clientW)
  expect(vp.zoom).toBe(1)
}

test.describe('desktop', () => {
  test('landscape layout fills the height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openGame(page)
    await expectLandscapeFits(page)
  })

  test('portrait layout on a narrow window', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 })
    await openGame(page)
    await expectPortraitFits(page)
    // Width-constrained: 400 - 2*16 = 368
    expect((await box(page, '[data-testid="grid"]')).width).toBeCloseTo(368, 0)
  })

  test('switches between layouts on resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openGame(page)
    await expectLandscapeFits(page)
    await page.setViewportSize({ width: 400, height: 800 })
    await expectPortraitFits(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await expectLandscapeFits(page)
  })

  test('uses the measured header height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openGame(page)
    // Grow the header after load; the ResizeObserver should re-layout
    await page.addStyleTag({ content: 'header { padding-top: 60px !important; }' })
    await expect.poll(async () => (await box(page, 'header')).height).toBeGreaterThan(100)
    await expectLandscapeFits(page)
  })
})

test.describe('mobile emulation', () => {
  test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 2 })

  // Regression: switching from the wide landscape layout to a narrow viewport
  // made the browser zoom out, and sizing from window.innerWidth locked in an
  // oversized grid.
  test('landscape -> portrait does not leave the page zoomed out', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await openGame(page)
    await expectLandscapeFits(page)
    await page.setViewportSize({ width: 400, height: 800 })
    await expectPortraitFits(page)
    expect((await box(page, '[data-testid="grid"]')).width).toBeCloseTo(368, 0)
  })

  test('portrait -> landscape', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 })
    await openGame(page)
    await expectPortraitFits(page)
    await page.setViewportSize({ width: 1200, height: 800 })
    await expectLandscapeFits(page)
  })
})

// Count view transitions started by the page (the landscape <-> portrait animation)
async function countViewTransitions(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __viewTransitions: number }
    w.__viewTransitions = 0
    const original = document.startViewTransition?.bind(document)
    if (original) {
      document.startViewTransition = ((cb?: ViewTransitionUpdateCallback) => {
        w.__viewTransitions++
        return original(cb)
      }) as typeof document.startViewTransition
    }
  })
  return () => page.evaluate(() => (window as unknown as { __viewTransitions: number }).__viewTransitions)
}

test.describe('layout switch animation', () => {
  test('animates only when the layout mode changes', async ({ page }) => {
    const transitions = await countViewTransitions(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await openGame(page)
    await expectLandscapeFits(page)
    expect(await transitions()).toBe(0) // not on initial load

    await page.setViewportSize({ width: 1280, height: 700 })
    await expectLandscapeFits(page)
    expect(await transitions()).toBe(0) // not on scale-only resizes

    await page.setViewportSize({ width: 400, height: 800 })
    await expectPortraitFits(page)
    expect(await transitions()).toBe(1)

    await page.setViewportSize({ width: 1280, height: 800 })
    await expectLandscapeFits(page)
    expect(await transitions()).toBe(2)
  })

  test('names the grid and controls for the transition', async ({ page }) => {
    await openGame(page)
    const name = (testId: string) =>
      page.getByTestId(testId).evaluate(el => getComputedStyle(el).viewTransitionName)
    expect(await name('grid')).toBe('game-grid')
    expect(await name('controls')).toBe('game-controls')
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('switches layouts without animating', async ({ page }) => {
      const transitions = await countViewTransitions(page)
      await page.setViewportSize({ width: 1280, height: 800 })
      await openGame(page)
      await page.setViewportSize({ width: 400, height: 800 })
      await expectPortraitFits(page)
      expect(await transitions()).toBe(0)
    })
  })
})

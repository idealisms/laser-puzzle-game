import { test, expect, Page } from '@playwright/test'

// Time spent on a puzzle counts from the first mirror placed, and pauses while the
// tab is hidden. Uses Playwright's fake clock and reads timeSpentSeconds from the
// submission request.

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

// Serve a fixed level and capture the submission so the test doesn't touch the database.
async function openGame(page: Page) {
  const submissions: { timeSpentSeconds: number }[] = []
  await page.route('**/api/levels/2026-01-01', route => route.fulfill({ json: { level: LEVEL } }))
  await page.route('**/api/progress', route => {
    submissions.push(route.request().postDataJSON())
    return route.fulfill({ json: { score: 1, histogram: { distribution: {}, totalPlayers: 1 } } })
  })
  await page.addInitScript(() => {
    // Returning player, so the first-visit How To Play modal stays closed.
    localStorage.setItem('laser-puzzle-progress', JSON.stringify({ '2000-01-01': { bestScore: 1 } }))
  })
  await page.clock.install()
  await page.goto('/game/2026-01-01')
  await expect(page.getByTestId('grid')).toBeVisible()
  return submissions
}

// Click the centre of grid cell (x, y).
async function placeMirror(page: Page, x: number, y: number) {
  const grid = page.getByTestId('grid')
  const b = await grid.boundingBox()
  if (!b) throw new Error('grid has no bounding box')
  const cell = b.width / LEVEL.gridWidth
  await grid.click({ position: { x: (x + 0.5) * cell, y: (y + 0.5) * cell } })
}

async function setVisibility(page: Page, state: 'visible' | 'hidden') {
  await page.evaluate(s => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

async function submit(page: Page, submissions: { timeSpentSeconds: number }[]) {
  await page.getByRole('button', { name: 'Submit Score' }).click()
  await expect.poll(() => submissions.length).toBe(1)
  return submissions[0].timeSpentSeconds
}

test('does not count time before the first mirror is placed', async ({ page }) => {
  const submissions = await openGame(page)

  await page.clock.fastForward(60_000) // looking at the puzzle, no mirrors yet
  await placeMirror(page, 5, 0)
  await page.clock.fastForward(10_000)

  expect(await submit(page, submissions)).toBe(10)
})

test('pauses while the tab is hidden after the first mirror', async ({ page }) => {
  const submissions = await openGame(page)

  await placeMirror(page, 5, 0)
  await page.clock.fastForward(4_000)
  await setVisibility(page, 'hidden')
  await page.clock.fastForward(120_000) // backgrounded, should not count
  await setVisibility(page, 'visible')
  await page.clock.fastForward(3_000)

  expect(await submit(page, submissions)).toBe(7)
})

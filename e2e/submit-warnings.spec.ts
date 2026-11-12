import { test, expect, Page } from '@playwright/test'

// Submitting a path that looks unfinished asks "Are you sure?" first.

const LEVEL = {
  id: 'e2e',
  date: '2026-01-01',
  gridWidth: 15,
  gridHeight: 20,
  laserConfig: { x: 0, y: 0, direction: 'right' },
  obstacles: [],
  mirrorsAvailable: 2,
  optimalScore: 100,
  optimalSolution: null,
}

async function openGame(page: Page) {
  const submissions: unknown[] = []
  await page.route('**/api/levels/2026-01-01', route => route.fulfill({ json: { level: LEVEL } }))
  await page.route('**/api/progress', route => {
    submissions.push(route.request().postDataJSON())
    return route.fulfill({ json: { score: 1, histogram: { distribution: {}, totalPlayers: 1 } } })
  })
  await page.addInitScript(() => {
    // Returning player, so the first-visit How To Play modal stays closed.
    localStorage.setItem('laser-puzzle-progress', JSON.stringify({ '2000-01-01': { bestScore: 1 } }))
  })
  await page.goto('/game/2026-01-01')
  await expect(page.getByTestId('grid')).toBeVisible()
  return submissions
}

// Clicking a cell cycles empty → / → \ → empty.
async function click(page: Page, x: number, y: number, times = 1) {
  const grid = page.getByTestId('grid')
  const b = (await grid.boundingBox())!
  const cell = b.width / LEVEL.gridWidth
  for (let i = 0; i < times; i++) {
    await grid.click({ position: { x: (x + 0.5) * cell, y: (y + 0.5) * cell } })
  }
}

// \ at (5,0) turns the beam down; / at (5,19) turns it left along the bottom
// row. Both are used, and each step makes the path longer, so the final path is
// also the best one.
async function placeGoodPath(page: Page) {
  await click(page, 5, 0, 2)
  await click(page, 5, 19, 1)
}

const dialog = (page: Page) => page.getByRole('alertdialog')
const submitButton = (page: Page) => page.getByRole('button', { name: 'Submit Score' })

test('a finished path submits without asking', async ({ page }) => {
  const submissions = await openGame(page)
  await placeGoodPath(page)
  await submitButton(page).click()

  await expect.poll(() => submissions.length).toBe(1)
  await expect(dialog(page)).toHaveCount(0)
})

test('mirrors left to place: asks, and Don\'t Submit goes back to the puzzle', async ({ page }) => {
  const submissions = await openGame(page)
  await click(page, 5, 0, 2)
  await submitButton(page).click()

  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).getByRole('heading')).toHaveText('Are you sure?')
  await expect(dialog(page)).toContainText('You still have 1 mirror left to place.')
  await expect(dialog(page)).toContainText('You only get one submission per puzzle.')
  // The safe choice has focus, so Enter doesn't submit by accident.
  await expect(page.getByRole('button', { name: "Don't Submit" })).toBeFocused()

  await page.getByRole('button', { name: "Don't Submit" }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(submitButton(page)).toBeVisible()
  expect(submissions).toHaveLength(0)
})

test('Submit Anyway submits and shows the results', async ({ page }) => {
  const submissions = await openGame(page)
  await click(page, 5, 0, 2)
  await submitButton(page).click()
  await page.getByRole('button', { name: 'Submit Anyway' }).click()

  await expect.poll(() => submissions.length).toBe(1)
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show Results' })).toBeVisible()
})

test('Escape and the backdrop cancel', async ({ page }) => {
  const submissions = await openGame(page)
  await click(page, 5, 0, 2)

  await submitButton(page).click()
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)

  await submitButton(page).click()
  await expect(dialog(page)).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(dialog(page)).toHaveCount(0)

  expect(submissions).toHaveLength(0)
})

test('warns about a mirror the laser misses', async ({ page }) => {
  await openGame(page)
  await click(page, 5, 0, 2)
  await click(page, 10, 15, 1) // nowhere near the beam
  await submitButton(page).click()

  await expect(dialog(page).locator('[data-warning]')).toHaveCount(1)
  await expect(dialog(page)).toContainText("1 of your mirrors isn’t touched by the laser")
})

test('warns when the current path is shorter than the best one, along with the rest', async ({ page }) => {
  await openGame(page)
  await placeGoodPath(page)
  await click(page, 5, 0, 1) // \ → empty: a shorter path, and (5,19) is now unused
  await submitButton(page).click()

  const warnings = dialog(page).locator('[data-warning]')
  await expect(warnings).toHaveCount(3)
  await expect(warnings.nth(0)).toHaveAttribute('data-warning', 'unplaced-mirrors')
  await expect(warnings.nth(1)).toHaveAttribute('data-warning', 'unused-mirrors')
  await expect(warnings.nth(2)).toHaveAttribute('data-warning', 'not-best')
  await expect(warnings.nth(2)).toContainText(/This path is 15 long, but you reached \d+ earlier/)
})

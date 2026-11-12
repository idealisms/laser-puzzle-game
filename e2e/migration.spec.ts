import { test, expect, Page, Browser } from '@playwright/test'

// Moving players from the old domain to the new one. In dev (see next.config.ts)
// 127.0.0.1:3000 plays the old host and localhost:3000 the new one: same server,
// but two origins with separate localStorage, just like the real move.

const OLD = 'http://127.0.0.1:3000'
const NEW = 'http://localhost:3000'

const ID_OLD = '11111111-1111-4111-8111-111111111111'
const ID_NEW = '22222222-2222-4222-8222-222222222222'

const SOLUTION = [
  { position: { x: 5, y: 0 }, type: '\\' },
  { position: { x: 5, y: 7 }, type: '/' },
]

const OLD_PROGRESS = {
  '2026-01-01': { bestScore: 42, bestSolution: SOLUTION, optimalScore: 100 },
  '2025-12-31': { bestScore: 17, optimalScore: 80 },
}

function level(date: string) {
  return {
    id: `e2e-${date}`,
    date,
    gridWidth: 15,
    gridHeight: 20,
    laserConfig: { x: 0, y: 0, direction: 'right' },
    obstacles: [],
    mirrorsAvailable: 10,
    optimalScore: 100,
    optimalSolution: null,
  }
}

// Serve levels and capture submissions so the tests don't touch the database.
async function mockApi(page: Page) {
  const submissions: { anonId: string; levelDate: string }[] = []
  await page.route('**/api/levels/*', route => {
    const date = new URL(route.request().url()).pathname.split('/').pop()!
    return route.fulfill({ json: { level: level(date) } })
  })
  await page.route('**/api/progress', route => {
    submissions.push(route.request().postDataJSON())
    return route.fulfill({ json: { score: 1, histogram: { distribution: {}, totalPlayers: 1 } } })
  })
  await page.route('**/api/scores/histogram*', route =>
    route.fulfill({ json: { distribution: {}, totalPlayers: 1 } })
  )
  return submissions
}

// Static files aren't redirected, so they're a way to reach an origin's storage
// without running the app.
async function setStorage(page: Page, origin: string, items: Record<string, unknown>) {
  await page.goto(`${origin}/icon.svg`)
  await page.evaluate(entries => {
    for (const [k, v] of Object.entries(entries)) {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
    }
  }, items)
}

async function readStorage(page: Page) {
  return page.evaluate(() => ({
    anonId: localStorage.getItem('laser-puzzle-anon-id'),
    progress: JSON.parse(localStorage.getItem('laser-puzzle-progress') ?? 'null'),
    settings: JSON.parse(localStorage.getItem('laser-puzzle-settings') ?? 'null'),
  }))
}

async function seedOldSite(page: Page) {
  await setStorage(page, OLD, {
    'laser-puzzle-anon-id': ID_OLD,
    'laser-puzzle-progress': OLD_PROGRESS,
    'laser-puzzle-settings': { colorblindMode: true, showBlipAnimations: false },
    'laser-puzzle-calendar': { stale: true },
  })
}

test('carries progress, player ID and settings to the same page on the new site', async ({ page }) => {
  await mockApi(page)
  await seedOldSite(page)

  await page.goto(`${OLD}/game/2026-01-01`)
  await page.waitForURL(`${NEW}/game/2026-01-01`)

  expect(await readStorage(page)).toEqual({
    anonId: ID_OLD,
    progress: OLD_PROGRESS,
    settings: { colorblindMode: true, showBlipAnimations: false },
  })
  // Caches stay behind.
  expect(await page.evaluate(() => localStorage.getItem('laser-puzzle-calendar'))).toBeNull()

  // The game sees a returning player who already submitted today.
  await expect(page.getByRole('button', { name: 'Show Results' })).toBeVisible()
  await expect(page.getByText('Submitted: 42')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeHidden()
})

test('removes the data from the address bar, so a reload does not import again', async ({ page }) => {
  await mockApi(page)
  await seedOldSite(page)

  await page.goto(`${OLD}/game/2026-01-01`)
  await page.waitForURL(`${NEW}/game/2026-01-01`)
  expect(new URL(page.url()).hash).toBe('')

  // A score improved on the new site survives a reload.
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('laser-puzzle-progress')!)
    p['2026-01-01'].bestScore = 99
    localStorage.setItem('laser-puzzle-progress', JSON.stringify(p))
  })
  await page.reload()
  await expect(page.getByText('Submitted: 99')).toBeVisible()
})

test('keeps the path and query string', async ({ page }) => {
  await mockApi(page)
  await seedOldSite(page)

  await page.goto(`${OLD}/game/2025-12-31?from=bookmark`)
  await page.waitForURL(`${NEW}/game/2025-12-31?from=bookmark`)
  await expect(page.getByText('Submitted: 17')).toBeVisible()
})

test('later submissions use the imported player ID', async ({ page }) => {
  const submissions = await mockApi(page)
  await seedOldSite(page)

  await page.goto(`${OLD}/game/2026-01-02`)
  await page.waitForURL(`${NEW}/game/2026-01-02`)

  const grid = page.getByTestId('grid')
  await expect(grid).toBeVisible()
  const b = (await grid.boundingBox())!
  const cell = b.width / 15
  await grid.click({ position: { x: 5.5 * cell, y: 0.5 * cell } })
  await page.getByRole('button', { name: 'Submit Score' }).click()
  // Only one mirror is placed, so the game asks first.
  await page.getByRole('button', { name: 'Submit Anyway' }).click()

  await expect.poll(() => submissions.length).toBe(1)
  expect(submissions[0]).toMatchObject({ anonId: ID_OLD, levelDate: '2026-01-02' })
})

test('merges with data already on the new site', async ({ page }) => {
  await mockApi(page)
  await seedOldSite(page)
  await setStorage(page, NEW, {
    'laser-puzzle-anon-id': ID_NEW,
    'laser-puzzle-progress': {
      '2026-01-01': { bestScore: 60 }, // better than the old site's 42
      '2025-12-31': { bestScore: 5 }, // worse than the old site's 17
      '2025-12-30': { bestScore: 8 }, // only here
    },
    'laser-puzzle-settings': { colorblindMode: false },
  })

  await page.goto(`${OLD}/game/2026-01-01`)
  await page.waitForURL(`${NEW}/game/2026-01-01`)

  expect(await readStorage(page)).toEqual({
    anonId: ID_NEW, // has history here, so it stays
    progress: {
      '2026-01-01': { bestScore: 60 },
      '2025-12-31': OLD_PROGRESS['2025-12-31'],
      '2025-12-30': { bestScore: 8 },
    },
    settings: { colorblindMode: false },
  })
  await expect(page.getByText('Submitted: 60')).toBeVisible()
})

test('a player with nothing saved is sent over with no data', async ({ page }) => {
  await mockApi(page)

  await page.goto(`${OLD}/game/2026-01-01`)
  await page.waitForURL(`${NEW}/game/2026-01-01`)

  expect(await readStorage(page)).toEqual({ anonId: null, progress: null, settings: null })
  // First-time player, so the tutorial opens.
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible()
})

test('the home page redirects too', async ({ page }) => {
  await mockApi(page)
  await seedOldSite(page)

  await page.goto(`${OLD}/`)
  await page.waitForURL(`${NEW}/`)
  expect((await readStorage(page)).anonId).toBe(ID_OLD)
})

test('shows a link to the new site when JavaScript is off', async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto(`${OLD}/game/2026-01-01`)

  await expect(page.getByRole('heading', { name: 'Laser Puzzle has moved' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go now' })).toHaveAttribute('href', NEW)
  expect(page.url()).toBe(`${OLD}/game/2026-01-01`)
  await context.close()
})

test('static files and API routes still work on the old site', async ({ request }) => {
  const icon = await request.get(`${OLD}/icon.svg`)
  expect(icon.ok()).toBe(true)
  expect(icon.headers()['content-type']).toContain('image/svg')

  // Not rewritten to the moved page (which would be HTML with a 200).
  const api = await request.get(`${OLD}/api/levels/not-a-date`)
  expect(api.headers()['content-type']).toContain('application/json')
})

test('opening /moved on the new site goes to the home page', async ({ page }) => {
  await mockApi(page)
  await page.goto(`${NEW}/moved`)
  await page.waitForURL(`${NEW}/`)
})

test.describe('links made up to look like a move', () => {
  test('garbage data is ignored and removed from the address bar', async ({ page }) => {
    await mockApi(page)
    await page.goto(`${NEW}/game/2026-01-01#migrate=v1.%%%not-base64`)
    await expect(page.getByTestId('grid')).toBeVisible()

    expect(new URL(page.url()).hash).toBe('')
    expect(await readStorage(page)).toEqual({ anonId: null, progress: null, settings: null })
  })

  test('an unknown version is ignored', async ({ page }) => {
    await mockApi(page)
    const data = Buffer.from(JSON.stringify({ anonId: ID_OLD })).toString('base64url')
    await page.goto(`${NEW}/game/2026-01-01#migrate=v9.${data}`)
    await expect(page.getByTestId('grid')).toBeVisible()

    expect(new URL(page.url()).hash).toBe('')
    expect((await readStorage(page)).anonId).toBeNull()
  })

  test('malformed fields are dropped and scores never go down', async ({ page }) => {
    await mockApi(page)
    await setStorage(page, NEW, {
      'laser-puzzle-anon-id': ID_NEW,
      'laser-puzzle-progress': { '2026-01-01': { bestScore: 60 } },
    })
    const forged = {
      anonId: ID_OLD,
      progress: {
        '2026-01-01': { bestScore: 10 },
        '2026-01-02': { bestScore: -5 },
        '<script>': { bestScore: 1 },
        '2026-01-03': { bestScore: 7, bestSolution: [{ position: { x: 1e9, y: 0 }, type: '/' }] },
      },
      settings: { colorblindMode: 'yes' },
    }
    const data = Buffer.from(JSON.stringify(forged)).toString('base64url')
    await page.goto(`${NEW}/game/2026-01-01#migrate=v1.${data}`)
    await expect(page.getByText('Submitted: 60')).toBeVisible()

    expect(await readStorage(page)).toEqual({
      anonId: ID_NEW,
      progress: { '2026-01-01': { bestScore: 60 }, '2026-01-03': { bestScore: 7 } },
      settings: null,
    })
  })

  test('the old site does not import data from a link', async ({ page }) => {
    await mockApi(page)
    const data = Buffer.from(JSON.stringify({ anonId: ID_OLD })).toString('base64url')
    await page.goto(`${OLD}/game/2026-01-01#migrate=v1.${data}`)
    await page.waitForURL(`${NEW}/game/2026-01-01`)

    // Nothing was saved on the old site, so nothing was carried over.
    expect((await readStorage(page)).anonId).toBeNull()
  })
})

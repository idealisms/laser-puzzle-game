import { test, expect, Page } from '@playwright/test'

// Per-puzzle titles and link-preview images, and the share link. The metadata
// tests read the local database (run `npm run db:seed` once): 2026-01-22 is
// the first puzzle, "Chamber Grid".

test.describe('puzzle page metadata', () => {
  test('has the date and name in the title, a description and a canonical URL', async ({ request }) => {
    const html = await (await request.get('/game/2026-01-22')).text()
    expect(html).toContain('<title>Laser Puzzle – Jan 22, 2026: Chamber Grid</title>')
    expect(html).toMatch(/<meta name="description" content="The Laser Puzzle for Jan 22, 2026: Chamber Grid\. Place \d+ mirrors/)
    expect(html).toContain('<link rel="canonical" href="http://localhost:3000/game/2026-01-22"/>')
    expect(html).toContain('<meta property="og:title" content="Laser Puzzle – Jan 22, 2026: Chamber Grid"/>')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>')
    expect(html).toMatch(/<meta property="og:image" content="http:\/\/localhost:3000\/game\/2026-01-22\/opengraph-image/)
  })

  test('serves a 1200×630 preview image', async ({ request }) => {
    const res = await request.get('/game/2026-01-22/opengraph-image')
    expect(res.headers()['content-type']).toBe('image/png')
    const png = await res.body()
    // PNG header: width and height are big-endian at bytes 16 and 20.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
  })

  test('a date with no puzzle says nothing and stays out of search', async ({ request }) => {
    const html = await (await request.get('/game/1999-01-01')).text()
    expect(html).toContain('<meta name="robots" content="noindex"/>')
    expect(html).toContain('<title>Laser Puzzle – a free daily mirror logic game</title>')
    const image = await request.get('/game/1999-01-01/opengraph-image')
    expect(image.ok()).toBe(true)
  })

  test('the site has a default preview image', async ({ request }) => {
    const html = await (await request.get('/how-to-play')).text()
    expect(html).toMatch(/<meta property="og:image" content="http:\/\/localhost:3000\/opengraph-image/)
    const image = await request.get('/opengraph-image')
    expect(image.headers()['content-type']).toBe('image/png')
  })
})

test.describe('sharing results', () => {
  const LEVEL = {
    id: 'e2e',
    date: '2026-01-01',
    gridWidth: 15,
    gridHeight: 20,
    laserConfig: { x: 0, y: 0, direction: 'right' },
    obstacles: [],
    mirrorsAvailable: 1,
    optimalScore: 100,
    optimalSolution: null,
  }

  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  // Submit a one-mirror solution and open the results.
  async function finishPuzzle(page: Page) {
    await page.route('**/api/levels/2026-01-01', route => route.fulfill({ json: { level: LEVEL } }))
    await page.route('**/api/progress', route =>
      route.fulfill({ json: { score: 25, histogram: { distribution: {}, totalPlayers: 1 } } })
    )
    await page.goto('/game/2026-01-01')
    const grid = page.getByTestId('grid')
    const b = (await grid.boundingBox())!
    const cell = b.width / 15
    // \ at (5,0) turns the beam down the column: one mirror, all used.
    await grid.click({ position: { x: 5.5 * cell, y: 0.5 * cell } })
    await grid.click({ position: { x: 5.5 * cell, y: 0.5 * cell } })
    await page.getByRole('button', { name: 'Submit Score' }).click()
    await page.getByRole('button', { name: 'Share' }).click()
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible()
    return page.evaluate(() => navigator.clipboard.readText())
  }

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Returning player, so the first-visit How To Play modal stays closed.
      localStorage.setItem('laser-puzzle-progress', JSON.stringify({ '2000-01-01': { bestScore: 1 } }))
    })
  })

  test('links to that day’s puzzle with a full URL', async ({ page }) => {
    const text = await finishPuzzle(page)
    expect(text.split('\n')).toEqual([
      'Laser Puzzle 2026/01/01',
      expect.stringMatching(/^25%/),
      'http://localhost:3000/game/2026-01-01',
    ])
  })

  test('the setting leaves the link out', async ({ page }) => {
    await page.goto('/how-to-play')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    const toggle = page.getByRole('switch', { name: 'Include link when sharing' })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    const text = await finishPuzzle(page)
    expect(text).not.toContain('http')
    expect(text.split('\n')).toHaveLength(2)
  })
})

import { test, expect } from '@playwright/test'
import { EXAMPLES } from '../src/app/how-to-play/examples'

// Text search engines can read without running JavaScript, the how-to-play
// guide and its example boards, sitemap.xml and robots.txt.

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

test('the home page HTML has a title, description and readable text', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toContain('<title>Laser Puzzle – a free daily mirror logic game</title>')
  expect(html).toMatch(/<meta name="description" content="A free daily logic puzzle: place mirrors/)
  expect(html).toMatch(/<link rel="canonical" href="http:\/\/localhost:3000"/)
  expect(html).toContain('Laser Puzzle: a daily mirror puzzle</h1>')
  expect(html).toContain('href="/how-to-play"')
})

test('the guide HTML has its own title and all the rules, without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/how-to-play')

  await expect(page).toHaveTitle('How to Play Laser Puzzle: Mirrors, Splitters, Gates and Portals')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to play Laser Puzzle')
  for (const heading of ['The goal', 'Mirrors', 'Walls', 'Splitters', 'One-way gates', 'Portals', 'Collisions', 'Strategy tips']) {
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible()
  }
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://localhost:3000/how-to-play')
  await context.close()
})

test('the guide draws every example board with the engine', async ({ page }) => {
  await page.goto('/how-to-play')
  const boards = page.locator('canvas[data-testid^="example-"]')
  await expect(boards).toHaveCount(Object.keys(EXAMPLES).length)

  // Scores come from the real engine and are shown in the captions.
  await expect(page.getByTestId('example-mirrors')).toHaveAttribute('data-score', '16')
  await expect(page.getByTestId('example-splitter-split')).toHaveAttribute('data-score', '10')
  await expect(page.getByText('Path length: 16.')).toBeVisible()

  // Something was actually drawn: the beam's red is on the canvas.
  // Drawing happens on the next animation frame, so wait for it.
  const hasBeam = () =>
    page.getByTestId('example-mirrors').evaluate((c: HTMLCanvasElement) => {
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      for (let i = 0; i < data.length; i += 4) if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) return true
      return false
    })
  await expect.poll(hasBeam).toBe(true)
})

test('the guide fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/how-to-play')
  await expect(page.getByTestId('example-portals')).toBeVisible()
  const { scrollW, clientW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }))
  expect(scrollW).toBeLessThanOrEqual(clientW)
})

test('the guide links back to the game', async ({ page }) => {
  await page.route('**/api/levels/*', route => route.fulfill({ json: { level: LEVEL } }))
  await page.goto('/how-to-play')
  await page.getByRole('link', { name: "Play today's puzzle" }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('grid')).toBeVisible()
})

test('the How to Play popup links to the guide in a new tab', async ({ page }) => {
  await page.route('**/api/levels/*', route => route.fulfill({ json: { level: LEVEL } }))
  await page.goto('/game/2026-01-01') // first visit, so the popup opens
  const link = page.getByRole('link', { name: /Full guide/ })
  await expect(link).toHaveAttribute('href', '/how-to-play')
  await expect(link).toHaveAttribute('target', '_blank')
})

test('sitemap.xml lists the main pages', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  for (const path of ['/', '/how-to-play', '/game']) {
    expect(xml).toContain(`<loc>http://localhost:3000${path}</loc>`)
  }
})

test('robots.txt allows crawling, hides the API and points to the sitemap', async ({ request }) => {
  const txt = await (await request.get('/robots.txt')).text()
  expect(txt).toContain('Allow: /')
  expect(txt).toContain('Disallow: /api/')
  expect(txt).toContain('Sitemap: http://localhost:3000/sitemap.xml')
})

test('bold lead-ins in the guide are followed by a space', async ({ request }) => {
  const html = await (await request.get('/how-to-play')).text()
  expect(html).not.toMatch(/<\/strong>[A-Za-z]/)
})

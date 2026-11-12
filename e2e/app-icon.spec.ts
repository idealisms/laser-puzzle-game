import { test, expect, APIRequestContext } from '@playwright/test'

// Home-screen icons: iPhones need a PNG apple-touch-icon (they ignore SVG), and
// Android reads the web app manifest.

async function pngSize(request: APIRequestContext, url: string) {
  const res = await request.get(url)
  expect(res.headers()['content-type']).toBe('image/png')
  const png = await res.body()
  return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

test('the Apple touch icon is a 180×180 PNG', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const href = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1].replace(/&amp;/g, '&')
  expect(href).toMatch(/^\/apple-icon\.png/)
  expect(await pngSize(request, href!)).toEqual([180, 180])
})

test('the manifest names the game, opens in the browser, and has working icons', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"/>')
  expect(html).toContain('<meta name="theme-color" content="#111827"/>')

  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ name: 'Laser Puzzle', start_url: '/', display: 'browser' })
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons) {
    const [w, h] = icon.sizes.split('x').map(Number)
    expect(await pngSize(request, icon.src)).toEqual([w, h])
  }
})

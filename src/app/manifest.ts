import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Laser Puzzle',
    short_name: 'Laser Puzzle',
    description: 'A free daily mirror puzzle: bend the laser into the longest path you can.',
    start_url: '/',
    // Not "standalone": on iPhones a full-screen home-screen app gets its own
    // storage, separate from Safari's, so players would lose their history and
    // streak. "browser" opens the home-screen icon in the normal browser.
    display: 'browser',
    background_color: '#111827',
    theme_color: '#111827',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

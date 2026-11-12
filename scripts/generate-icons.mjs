// Renders the home-screen icons from scripts/app-icon.svg:
//   node scripts/generate-icons.mjs
// Re-run after changing the artwork. (sharp comes with Next.js.)
import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync(new URL('./app-icon.svg', import.meta.url))
const outputs = [
  ['src/app/apple-icon.png', 180], // iPhone/iPad "Add to Home Screen"
  ['public/icon-192.png', 192], // web app manifest
  ['public/icon-512.png', 512], // web app manifest, and listings
]
for (const [path, size] of outputs) {
  await sharp(svg, { density: (72 * size) / 32 }).resize(size, size).png().toFile(path)
  console.log(`${path} (${size}×${size})`)
}

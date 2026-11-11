import type { Metadata } from 'next'
import { MovedRedirect } from './MovedRedirect'

// Every page on the old host is rewritten here (see src/proxy.ts).
export const metadata: Metadata = {
  title: 'Laser Puzzle has moved',
  robots: { index: false },
}

export default function MovedPage() {
  return <MovedRedirect />
}

import type { Metadata } from 'next'
import { TodayGame } from './TodayGame'
import { SiteIntro } from '@/components/SiteIntro'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <>
      <TodayGame />
      <SiteIntro />
    </>
  )
}

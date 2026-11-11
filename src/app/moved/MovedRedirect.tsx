'use client'

import { useEffect, useRef } from 'react'
import { buildRedirectUrl, readPayload, MigrationPayload } from '@/lib/migration'
import { SITE_URL, SITE_HOST, isOldHost } from '@/lib/siteConfig'

export function MovedRedirect() {
  // Without JavaScript the link goes to the new home page; with it, it carries the data.
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    // Opened directly on the new site: nothing to move.
    if (!isOldHost(window.location.host)) {
      window.location.replace('/')
      return
    }

    let payload: MigrationPayload = {}
    try {
      payload = readPayload(window.localStorage)
    } catch {
      // storage blocked; still send the player to the new site
    }
    const url = buildRedirectUrl(SITE_URL, window.location.pathname + window.location.search, payload)
    if (linkRef.current) linkRef.current.href = url
    window.location.replace(url)
  }, [])

  return (
    <main className="min-h-svh flex flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold">Laser Puzzle has moved</h1>
      <p className="text-gray-300">
        Taking you to <span className="font-medium text-white">{SITE_HOST}</span> with your progress…
      </p>
      <a ref={linkRef} href={SITE_URL} className="text-emerald-400 underline">
        Go now
      </a>
    </main>
  )
}

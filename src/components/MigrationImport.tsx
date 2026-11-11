'use client'

import { useEffect } from 'react'
import { importFromLocationHash, stripMigrationHash } from '@/lib/migration'
import { isOldHost } from '@/lib/siteConfig'

// Import at module load, which happens before React renders anything, so the
// settings, progress and player ID are in place before any component reads them.
if (typeof window !== 'undefined' && !isOldHost(window.location.host)) {
  importFromLocationHash()
}

export function MigrationImport() {
  useEffect(() => {
    stripMigrationHash()
  }, [])
  return null
}

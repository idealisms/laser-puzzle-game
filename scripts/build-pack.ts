/**
 * Pack build script: builds the itch.io static export.
 *
 * The Next.js static export (output: 'export') does not support API routes.
 * Since the pack build fetches all data from static /puzzles/*.json files,
 * the API routes are completely unused. This script temporarily moves them
 * out of src/app/ before the build, then restores them afterward — ensuring
 * the build only sees the page routes that belong in the static export.
 *
 * Usage: npx tsx scripts/build-pack.ts
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const repoRoot = path.resolve(__dirname, '..')
const apiDir = path.join(repoRoot, 'src', 'app', 'api')
const apiBackupDir = path.join(repoRoot, 'src', 'app', '_api_pack_bak')

function restoreApi() {
  if (fs.existsSync(apiBackupDir)) {
    if (fs.existsSync(apiDir)) {
      fs.rmSync(apiDir, { recursive: true })
    }
    fs.renameSync(apiBackupDir, apiDir)
    console.log('Restored API routes.')
  }
}

// Ensure a previous interrupted build is not leaving stale backup
if (fs.existsSync(apiBackupDir)) {
  console.error(
    `Error: ${apiBackupDir} already exists. A previous pack build may have failed.\n` +
    `Restore it manually: mv src/app/_api_pack_bak src/app/api`
  )
  process.exit(1)
}

// Move API routes out of the app directory
if (fs.existsSync(apiDir)) {
  fs.renameSync(apiDir, apiBackupDir)
  console.log('Moved API routes aside for pack build.')
}

// Generate Prisma client types (needed for TypeScript even though pack mode
// never calls the database; prisma generate does not require a live DB).
console.log('Generating Prisma client...')
execSync('npx prisma generate', { stdio: 'inherit', cwd: repoRoot })

try {
  execSync('next build', {
    stdio: 'inherit',
    cwd: repoRoot,
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_MODE: 'pack',
      NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS: '1',
    },
  })
} finally {
  restoreApi()
}

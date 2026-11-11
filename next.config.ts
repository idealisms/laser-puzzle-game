import type { NextConfig } from "next";
import { execSync } from "child_process";

const gitHash = execSync('git rev-parse --short HEAD').toString().trim();

// Where the site lives and which hosts redirect to it (with the player's data).
// Either can be overridden with NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_MIGRATE_FROM_HOSTS.
// - production: laser-puzzle-game.vercel.app → laserpuzzle.ponderer.org
// - preview: the branch URL → this deployment's own URL, to try the move by hand
// - dev: 127.0.0.1:3000 → localhost:3000 (two origins, for the browser tests)
function siteDefaults(): { siteUrl: string; migrateFrom: string } {
  if (process.env.VERCEL_ENV === 'production') {
    return { siteUrl: 'https://laserpuzzle.ponderer.org', migrateFrom: 'laser-puzzle-game.vercel.app' };
  }
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return {
      siteUrl: `https://${process.env.VERCEL_URL}`,
      migrateFrom: process.env.VERCEL_BRANCH_URL ?? '',
    };
  }
  if (process.env.NODE_ENV === 'development') {
    return { siteUrl: 'http://localhost:3000', migrateFrom: '127.0.0.1:3000' };
  }
  return { siteUrl: 'https://laserpuzzle.ponderer.org', migrateFrom: '' };
}

const defaults = siteDefaults();

const nextConfig: NextConfig = {
  // The browser tests load the dev server as 127.0.0.1 (the "old host") too.
  allowedDevOrigins: ['127.0.0.1'],
  env: {
    NEXT_PUBLIC_SITE_VERSION: gitHash,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || defaults.siteUrl,
    NEXT_PUBLIC_MIGRATE_FROM_HOSTS: process.env.NEXT_PUBLIC_MIGRATE_FROM_HOSTS ?? defaults.migrateFrom,
  },
};

export default nextConfig;

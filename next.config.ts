import type { NextConfig } from "next";
import { execSync } from "child_process";

const gitHash = execSync('git rev-parse --short HEAD').toString().trim();

const isPack = process.env.NEXT_PUBLIC_APP_MODE === 'pack'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packConfig = isPack ? require('./puzzle-packs/pack.json') : {}

const nextConfig: NextConfig = {
  ...(isPack && { output: 'export' }),
  ...(isPack && { images: { unoptimized: true } }),
  env: {
    NEXT_PUBLIC_SITE_VERSION: gitHash,
    NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE ?? '',
    ...(isPack && {
      NEXT_PUBLIC_PACK_SUBTITLE: packConfig.subtitle,
      NEXT_PUBLIC_DAILY_SITE_URL: packConfig.dailySiteUrl,
      NEXT_PUBLIC_DAILY_SITE_NAME: packConfig.dailySiteName,
    }),
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { execSync } from "child_process";

const gitHash = execSync('git rev-parse --short HEAD').toString().trim();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SITE_VERSION: gitHash,
  },
};

export default nextConfig;

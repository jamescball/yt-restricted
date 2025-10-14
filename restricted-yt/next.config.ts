// restricted-yt/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Needed so Docker can copy .next/standalone
  output: "standalone",
  // Optional but useful for your app:
  experimental: {
    // keep as you like; using Turbopack already via the CLI flag
  },
  reactStrictMode: true,
};

export default nextConfig;

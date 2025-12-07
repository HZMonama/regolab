import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Rewrites are handled by middleware.ts to support runtime environment variables in Docker
  // async rewrites() { ... }
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Allow the sandboxed live-preview host (and any *.e2b.app proxy) to talk to the dev server.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "localhost:3000", "127.0.0.1:3000"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;

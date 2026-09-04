import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone with a minimal server.js so the Docker image
  // doesn't need the full node_modules folder.
  output: "standalone",
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@midnight-messenger/shared"],
  experimental: {
    // allow importing TS from workspace package
  },
};

export default nextConfig;

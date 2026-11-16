import type { NextConfig } from "next";

const repoBase = "/Night-Messenger-";
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  experimental: { cpus: 2 },
  // Trailing slash helps GitHub Pages serve nested routes as .../index.html
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@midnight-messenger/shared"],
  env: {
    NEXT_PUBLIC_BASE_PATH: isPages ? repoBase : "",
  },
  ...(isPages
    ? {
        basePath: repoBase,
        assetPrefix: repoBase,
      }
    : {}),
};

export default nextConfig;

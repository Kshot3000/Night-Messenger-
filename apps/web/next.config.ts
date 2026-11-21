import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { buildFingerprint, previewBuildFingerprint, readReleaseTarget } from "../../scripts/release-identity.mjs";

const require = createRequire(import.meta.url);

const repoBase = "/Night-Messenger-";
const isPages = process.env.GITHUB_PAGES === "true";
const network = process.env.NM_RELEASE_TARGET ?? "preview";
const target = readReleaseTarget(network);
const locked = target.network !== "preview";
if (locked && (isPages || process.env.NM_RELEASE_PREPARATION !== "1")) {
  throw new Error("Use pnpm build:release <preprod|mainnet> for a locked release export");
}
const fingerprint = locked ? buildFingerprint(network) : previewBuildFingerprint();
const lockedSurface = fileURLToPath(new URL("./src/components/LockedRelease.tsx", import.meta.url));

const midnightPackages = [
  "@midnight-messenger/shared",
  "@midnight-ntwrk/compact-runtime",
  "@midnightntwrk/onchain-runtime-v4",
  "@midnight-ntwrk/midnight-js-contracts",
  "@midnight-ntwrk/midnight-js-dapp-connector-proof-provider",
  "@midnight-ntwrk/midnight-js-fetch-zk-config-provider",
  "@midnight-ntwrk/midnight-js-http-client-proof-provider",
  "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
  "@midnight-ntwrk/midnight-js-level-private-state-provider",
  "@midnight-ntwrk/midnight-js-protocol",
  "@midnight-ntwrk/midnight-js-types",
  "@midnight-ntwrk/midnight-js-utils",
  "@midnightntwrk/ledger-v9",
  "@midnightntwrk/dapp-connector-api",
];

const nextConfig: NextConfig = {
  output: "export",
  experimental: { cpus: 2 },
  // Trailing slash helps GitHub Pages serve nested routes as .../index.html
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: midnightPackages,
  env: {
    NEXT_PUBLIC_BASE_PATH: isPages ? repoBase : "",
    NEXT_PUBLIC_NM_BUILD_FINGERPRINT: JSON.stringify(fingerprint),
    NEXT_PUBLIC_NM_RELEASE_TARGET: network,
    ...(locked ? { NEXT_PUBLIC_SITE_URL: "https://build-only.invalid" } : {}),
  },
  webpack: (config, { webpack }) => {
    if (locked) {
      // Exclude the Preview implementations from the module graph of the
      // prepared export, including their simulator and tunnel request paths.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /^(?:@\/components\/(?:PrivateMessenger|ReceiptVerifier|ConnectWalletButton)|\.\/ConnectWalletButton|@\/hooks\/useWallet)$/,
        lockedSurface,
      ));
    }
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".js", ".ts", ".tsx"],
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      os: false,
      module: false,
      worker_threads: false,
      child_process: false,
      net: false,
      tls: false,
      http: false,
      https: false,
      url: false,
      zlib: false,
      events: require.resolve("events"),
      buffer: require.resolve("buffer"),
    };
    if (config.output) {
      config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm";
      config.output.environment = {
        ...config.output.environment,
        asyncFunction: true,
      };
    }
    return config;
  },
  ...(isPages
    ? {
        basePath: repoBase,
        assetPrefix: repoBase,
      }
    : {}),
};

export default nextConfig;

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { previewBuildFingerprint } from "./release-identity.mjs";

if (process.env.NM_RELEASE_TARGET && process.env.NM_RELEASE_TARGET !== "preview") {
  throw new Error("GitHub Pages is reserved for the Preview beta");
}

// Publish the Preview deployment record with the static site so /verify can
// show the live test contract (no secrets).
mkdirSync("apps/web/public", { recursive: true });
copyFileSync(
  path.join("deployments", "preview.json"),
  path.join("apps/web", "public", "preview.json"),
);

// Published ciphertext relay URL (Cloudflare quick tunnel). Updated on
// gh-pages without a rebuild by scripts/update-pages-relay.sh.
{
  const src = process.env.NM_PUBLIC_RELAY_URL_FILE || path.join("/workspace/var", "nm-relay-url");
  const dest = path.join("apps/web", "public", "relay.json");
  try {
    const url = readFileSync(src, "utf8").trim();
    if (/^https:\/\/[^\s]+$/.test(url)) {
      writeFileSync(dest, JSON.stringify({ relay: url.replace(/\/+$/, "") }, null, 2) + "\n");
    }
  } catch {
    /* no live tunnel URL on this machine; keep any existing public/relay.json */
  }
}

const copyZk = spawnSync(process.execPath, [path.join("scripts", "copy-zk-assets.mjs")], {
  stdio: "inherit",
});
if (copyZk.status !== 0) process.exit(copyZk.status || 1);

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  ["--filter", "@midnight-messenger/web", "build"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, GITHUB_PAGES: "true" },
  },
);
if (result.status !== 0) process.exit(result.status || 1);
writeFileSync("apps/web/out/.nojekyll", "");
writeFileSync("apps/web/out/release-fingerprint.json", JSON.stringify(previewBuildFingerprint(), null, 2) + "\n");

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Publish the Preview deployment record with the static site so /verify can
// show the live test contract (no secrets).
mkdirSync("apps/web/public", { recursive: true });
copyFileSync(
  path.join("deployments", "preview.json"),
  path.join("apps/web", "public", "preview.json"),
);

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

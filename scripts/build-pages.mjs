import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

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

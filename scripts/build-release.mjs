// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildFingerprint, repoRoot } from "./release-identity.mjs";

const target = process.argv[2];
if (!["preprod", "mainnet"].includes(target) || process.argv.length !== 3) {
  throw new Error("Usage: pnpm build:release <preprod|mainnet>");
}
if (process.env.GITHUB_PAGES === "true") throw new Error("Prepared exports cannot use the Preview Pages path");
const fingerprint = buildFingerprint(target);
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["build:web"], {
  cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32",
  env: { ...process.env, NM_RELEASE_TARGET: target, NM_RELEASE_PREPARATION: "1", NEXT_TELEMETRY_DISABLED: "1" },
});
if (result.status !== 0) process.exit(result.status ?? 1);

const output = join(repoRoot, "apps/web/out");
for (const name of ["preview.json", "relay.json", "zk"]) rmSync(join(output, name), { recursive: true, force: true });
const forbidden = /trycloudflare\.com|relay\.json|\?relay=|\/v1\/chain\/|indexer\.preview\.midnight\.network|localhost:878[78]/i;
for (const file of readdirSync(output, { recursive: true })) {
  if (/\.(?:js|html|txt)$/.test(file) && forbidden.test(readFileSync(join(output, file), "utf8"))) {
    throw new Error("Preview transport found in prepared export: " + file);
  }
}
const index = join(output, "private/index.html");
if (!existsSync(index) || !readFileSync(index, "utf8").includes(fingerprint.id)) {
  throw new Error("Prepared export is missing its build fingerprint");
}
writeFileSync(join(output, "release-fingerprint.json"), JSON.stringify(fingerprint, null, 2) + "\n");
console.log("Verified locked " + target + " export " + fingerprint.id);

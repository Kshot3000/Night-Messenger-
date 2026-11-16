#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Copy Compact compiler output into the web app:
 *   - contract JS/types into src/generated (committed; used by /verify)
 *   - compiler/, zkir/, and keys/ into public/zk for FetchZkConfigProvider
 *     (keys are gitignored on the source branch; the Pages publish includes them)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "contracts", "src", "managed", "night_messenger");
const generated = path.join(root, "apps", "web", "src", "generated", "night_messenger");
const publicZk = path.join(root, "apps", "web", "public", "zk", "night_messenger");

function copyFile(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to);
}

const contractJs = path.join(src, "contract", "index.js");
const contractDts = path.join(src, "contract", "index.d.ts");
if (existsSync(contractJs)) {
  copyFile(contractJs, path.join(generated, "contract", "index.js"));
  if (existsSync(contractDts)) copyFile(contractDts, path.join(generated, "contract", "index.d.ts"));
} else if (!existsSync(path.join(generated, "contract", "index.js"))) {
  throw new Error("Missing compiled contract JS (run pnpm compile:contracts, or keep the committed generated copy).");
}

const manifest = path.join(src, "compiler", "contract-manifest.json");
if (existsSync(manifest)) {
  const hash = createHash("sha256").update(readFileSync(manifest)).digest("hex");
  writeFileSync(
    path.join(generated, "manifest-hash.ts"),
    `// SPDX-License-Identifier: Apache-2.0\nexport const ZK_MANIFEST_SHA256 = "${hash}";\n`,
  );
}

function copyTree(name, required) {
  const from = path.join(src, name);
  if (!existsSync(from)) {
    if (required) throw new Error(`Missing ${from}`);
    return false;
  }
  const to = path.join(publicZk, name);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  return true;
}

copyTree("compiler", existsSync(path.join(src, "compiler")));
copyTree("zkir", existsSync(path.join(src, "zkir")));
const keys = copyTree("keys", false);
if (!keys) {
  console.warn(
    "No prover keys under contracts/src/managed/night_messenger/keys; testers will not be able to prove from this build.",
  );
}

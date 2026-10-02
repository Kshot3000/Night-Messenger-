import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Repo root, relative to apps/web/tests/.
// Note: a ready-to-enable GitHub Actions workflow (web-checks) is staged
// separately — the maintainer's gh token lacks the `workflow` scope to
// push workflow files, so the README documents the same checks as a
// local pre-publish gate until the workflow lands.
const root = new URL("../../../", import.meta.url);
const readRoot = (path) => readFileSync(new URL(path, root), "utf8");

test("README documents the web checks that gate publishing", () => {
  const readme = readRoot("README.md");
  for (const step of ["pnpm test", "pnpm typecheck", "pnpm lint", "pnpm build:web"]) {
    assert.ok(readme.includes(step), `README must document the \`${step}\` check`);
  }
});

test("share and outreach copy uses https for external sites (localhost exempt)", () => {
  for (const path of [
    "README.md",
    "share-night-messenger-nightdream.txt",
    "midnight-team-outreach.txt",
  ]) {
    const text = readRoot(path);
    const insecure = [...text.matchAll(/http:\/\/[^\s)\]"']+/g)]
      .map((m) => m[0])
      .filter((url) => !url.startsWith("http://localhost"));
    assert.deepEqual(insecure, [], `${path} contains insecure http:// links`);
  }
});

test("share copy carries the @kshot9000 attribution", () => {
  for (const path of [
    "share-night-messenger-nightdream.txt",
    "midnight-team-outreach.txt",
  ]) {
    assert.ok(
      readRoot(path).includes("@kshot9000"),
      `${path} must credit @kshot9000`,
    );
  }
});

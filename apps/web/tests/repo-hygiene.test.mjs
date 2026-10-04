import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Repo root, relative to apps/web/tests/.
const root = new URL("../../../", import.meta.url);
const readRoot = (path) => readFileSync(new URL(path, root), "utf8");

test("README documents the web checks that gate publishing", () => {
  const readme = readRoot("README.md");
  for (const step of ["pnpm test", "pnpm typecheck", "pnpm lint", "pnpm build:web"]) {
    assert.ok(readme.includes(step), `README must document the \`${step}\` check`);
  }
});

test("the Web checks workflow runs the documented gate on main pushes and PRs", () => {
  const workflow = readRoot(".github/workflows/web-checks.yml");
  assert.ok(workflow.includes("branches: [main]"), "workflow must trigger on main pushes");
  assert.ok(workflow.includes("pull_request:"), "workflow must trigger on pull requests");
  assert.ok(
    workflow.includes("pnpm install --frozen-lockfile"),
    "workflow must install with the frozen lockfile",
  );
  for (const step of ["pnpm test", "pnpm typecheck", "pnpm lint", "pnpm build:web"]) {
    assert.ok(workflow.includes(`run: ${step}`), `workflow must run \`${step}\``);
  }
  // Toolchain pins must match the README's documented gate.
  assert.ok(workflow.includes("version: 11.25.0"), "workflow must pin pnpm 11.25.0");
  assert.ok(workflow.includes("node-version: 24"), "workflow must use Node 24");
  assert.ok(
    workflow.includes("permissions:\n  contents: read"),
    "workflow must stay read-only",
  );
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

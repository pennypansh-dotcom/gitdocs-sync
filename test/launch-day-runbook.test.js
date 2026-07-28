const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");

test("launch day runbook covers the actual order of release, site, and payment steps", () => {
  const runbookPath = join(root, "docs", "launch-day-runbook.md");
  assert.equal(existsSync(runbookPath), true);

  const runbook = readFileSync(runbookPath, "utf8");
  assert.match(runbook, /npm\.cmd run release:check/);
  assert.match(runbook, /npm\.cmd run launch:configure/);
  assert.match(runbook, /Create tag `v0\.1\.0`/);
  assert.match(runbook, /Publish the GitHub Release/);
  assert.match(runbook, /live smoke/);
  assert.match(runbook, /pawsitiveme@outlook\.com/);
  assert.match(runbook, /Stripe/);
  assert.match(runbook, /docs\/github-release-v0\.1\.0\.md/);
});

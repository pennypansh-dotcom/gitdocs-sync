const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const script = join(root, "scripts", "verify-release-ready.js");

test("release readiness checker verifies the MVP Action package", () => {
  const output = execFileSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
  });

  assert.match(output, /Release readiness: OK/);
  assert.match(output, /action.yml -> dist\/index.js/);
  assert.match(output, /README uses pennypansh-dotcom\/gitdocs-sync@v0.1.0/);
  assert.match(output, /docs\/tomorrow-launch-operator-checklist\.md exists/);
  assert.match(output, /payment:links/);
  assert.match(output, /site:url/);
  assert.match(output, /smoke:validate/);
  assert.match(output, /landing pages include SEO and GEO metadata/);
  assert.match(output, /landing pages require registration before dry-run/);
  assert.match(output, /Chinese pages contain readable Chinese copy/);
  assert.match(output, /payment safety runbook covers Stripe-hosted checkout/);
  assert.match(output, /large-model API safeguards are documented/);
});

test("GitHub release notes are ready to paste for v0.1.0", () => {
  const notesPath = join(root, "docs", "github-release-v0.1.0.md");
  assert.equal(existsSync(notesPath), true);

  const notes = readFileSync(notesPath, "utf8");
  assert.match(notes, /GitDocs Sync v0\.1\.0/);
  assert.match(notes, /MVP/);
  assert.match(notes, /dry_run: "true"/);
  assert.match(notes, /GITDOCS_LICENSE_KEY/);
  assert.match(notes, /Docusaurus Markdown\/MDX/);
  assert.match(notes, /Do not send API keys/);
});

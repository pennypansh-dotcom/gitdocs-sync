const assert = require("node:assert/strict");
const { cpSync, mkdtempSync, readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");

const root = join(__dirname, "..");
const script = join(root, "scripts", "configure-payment-links.js");

test("payment link configurator swaps Pro and Team buttons to Stripe links", () => {
  const siteDir = mkdtempSync(join(tmpdir(), "gitdocs-site-"));
  cpSync(join(root, "site"), siteDir, { recursive: true });

  execFileSync(
    process.execPath,
    [
      script,
      "--site-dir",
      siteDir,
      "--pro-url",
      "https://buy.stripe.com/pro_test",
      "--team-url",
      "https://buy.stripe.com/team_test",
    ],
    { cwd: root, encoding: "utf8" },
  );

  for (const file of ["index.html", "zh.html"]) {
    const html = readFileSync(join(siteDir, file), "utf8");
    assert.match(html, /data-plan-link="pro" href="https:\/\/buy\.stripe\.com\/pro_test"/);
    assert.match(html, /data-plan-link="team" href="https:\/\/buy\.stripe\.com\/team_test"/);
    assert.match(html, /GitDocs%20Sync%20Enterprise/);
  }
});

test("payment link configurator rejects non-HTTPS payment links", () => {
  const siteDir = mkdtempSync(join(tmpdir(), "gitdocs-site-"));
  cpSync(join(root, "site"), siteDir, { recursive: true });

  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [script, "--site-dir", siteDir, "--pro-url", "http://example.test/pro", "--team-url", "https://buy.stripe.com/team_test"],
        { cwd: root, encoding: "utf8" },
      ),
    /Payment links must use HTTPS/,
  );
});

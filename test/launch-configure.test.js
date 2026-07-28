const assert = require("node:assert/strict");
const { cpSync, mkdtempSync, readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");

const root = join(__dirname, "..");
const script = join(root, "scripts", "configure-launch-day.js");

test("launch-day configurator applies site URL and payment links in one pass", () => {
  const siteDir = mkdtempSync(join(tmpdir(), "gitdocs-launch-"));
  cpSync(join(root, "site"), siteDir, { recursive: true });

  execFileSync(
    process.execPath,
    [
      script,
      "--site-dir",
      siteDir,
      "--url",
      "https://docsync.example",
      "--pro-url",
      "https://buy.stripe.com/pro_test",
      "--team-url",
      "https://buy.stripe.com/team_test",
    ],
    { cwd: root, encoding: "utf8" },
  );

  const index = readFileSync(join(siteDir, "index.html"), "utf8");
  const zh = readFileSync(join(siteDir, "zh.html"), "utf8");
  const sitemap = readFileSync(join(siteDir, "sitemap.xml"), "utf8");

  assert.match(index, /https:\/\/docsync\.example/);
  assert.match(zh, /https:\/\/docsync\.example/);
  assert.match(index, /data-plan-link="pro" href="https:\/\/buy\.stripe\.com\/pro_test"/);
  assert.match(index, /data-plan-link="team" href="https:\/\/buy\.stripe\.com\/team_test"/);
  assert.match(sitemap, /https:\/\/docsync\.example\/payment-success\.html/);
});

test("launch-day configurator rejects missing required URLs", () => {
  const siteDir = mkdtempSync(join(tmpdir(), "gitdocs-launch-"));
  cpSync(join(root, "site"), siteDir, { recursive: true });

  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [script, "--site-dir", siteDir, "--url", "https://docsync.example", "--pro-url", "https://buy.stripe.com/pro_test"],
        { cwd: root, encoding: "utf8" },
      ),
    /team-url/,
  );
});

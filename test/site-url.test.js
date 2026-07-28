const assert = require("node:assert/strict");
const { cpSync, mkdtempSync, readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");

const root = join(__dirname, "..");
const script = join(root, "scripts", "configure-site-url.js");

test("site URL configurator updates SEO and GEO URLs across the static site", () => {
  const siteDir = mkdtempSync(join(tmpdir(), "gitdocs-site-url-"));
  cpSync(join(root, "site"), siteDir, { recursive: true });

  execFileSync(process.execPath, [script, "--site-dir", siteDir, "--url", "https://docsync.example"], {
    cwd: root,
    encoding: "utf8",
  });

  const files = ["index.html", "zh.html", "payment-success.html", "zh-payment-success.html", "sitemap.xml", "robots.txt"];
  for (const file of files) {
    const text = readFileSync(join(siteDir, file), "utf8");
    assert.doesNotMatch(text, /https:\/\/gitdocs-sync\.com/);
    assert.match(text, /https:\/\/docsync\.example/);
  }
});

test("site URL configurator rejects non-HTTPS public URLs", () => {
  const siteDir = mkdtempSync(join(tmpdir(), "gitdocs-site-url-"));
  cpSync(join(root, "site"), siteDir, { recursive: true });

  assert.throws(
    () =>
      execFileSync(process.execPath, [script, "--site-dir", siteDir, "--url", "http://docsync.example"], {
        cwd: root,
        encoding: "utf8",
      }),
    /Site URL must use HTTPS/,
  );
});

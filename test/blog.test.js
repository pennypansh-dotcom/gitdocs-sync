const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("blog build creates SEO pages, RSS, sitemap, and safe external links", () => {
  const article = fs.readFileSync(path.join(root, "site", "blog", "docusaurus-translation-tools-comparison-2026.html"), "utf8");
  const index = fs.readFileSync(path.join(root, "site", "blog", "index.html"), "utf8");
  const sitemap = fs.readFileSync(path.join(root, "site", "sitemap.xml"), "utf8");
  assert.match(article, /"@type":"BlogPosting"/);
  assert.match(article, /href="https:\/\/github\.com\/Azure\/co-op-translator" rel="nofollow noopener noreferrer" target="_blank"/);
  assert.match(article, /href="https:\/\/pawsitivetime\.com\/#pricing"/);
  assert.doesNotMatch(article, /href="https:\/\/pawsitivetime\.com\/#pricing" rel=/);
  assert.match(index, /docusaurus-translation-tools-comparison-2026\.html/);
  assert.match(sitemap, /\/blog\/docusaurus-translation-tools-comparison-2026\.html/);
  assert.ok(fs.existsSync(path.join(root, "site", "blog", "rss.xml")));
});

const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");

test("landing pages expose SEO and GEO metadata for search and AI answer engines", () => {
  const en = readFileSync(join(root, "site", "index.html"), "utf8");
  const zh = readFileSync(join(root, "site", "zh.html"), "utf8");

  assert.match(en, /rel="canonical"/);
  assert.match(en, /hreflang="zh-CN"/);
  assert.match(en, /application\/ld\+json/);
  assert.match(en, /Docusaurus translation/);
  assert.match(en, /GitHub Action documentation translation/);
  assert.match(en, /AI answer engine summary/);

  assert.match(zh, /rel="canonical"/);
  assert.match(zh, /hreflang="en"/);
  assert.match(zh, /Docusaurus 多语言文档/);
  assert.match(zh, /AI 搜索摘要/);

  assert.equal(existsSync(join(root, "site", "robots.txt")), true);
  assert.equal(existsSync(join(root, "site", "sitemap.xml")), true);
});

test("customer-facing site pages do not contain common mojibake markers", () => {
  const pages = ["index.html", "zh.html", "payment-success.html", "zh-payment-success.html"];
  const mojibakeMarkers = [/涓/, /澶/, /瑷/, /鎽/, /浠樻/, /鍏嶈/, /淇濈/, /漏/, /�/];

  for (const page of pages) {
    const html = readFileSync(join(root, "site", page), "utf8");
    for (const marker of mojibakeMarkers) {
      assert.doesNotMatch(html, marker, `${page} should not contain mojibake marker ${marker}`);
    }
  }
});

test("landing page structured data is valid JSON-LD", () => {
  for (const page of ["index.html", "zh.html"]) {
    const html = readFileSync(join(root, "site", page), "utf8");
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(match, `${page} should include JSON-LD`);
    const parsed = JSON.parse(match[1]);
    assert.equal(parsed.name, "GitDocs Sync");
    assert.equal(parsed["@type"], "SoftwareApplication");
  }
});

test("launch risk runbook covers payment safety and large-model API safeguards", () => {
  const runbookPath = join(root, "docs", "launch-risk-runbook.md");
  assert.equal(existsSync(runbookPath), true);

  const runbook = readFileSync(runbookPath, "utf8");
  assert.match(runbook, /Stripe-hosted checkout/);
  assert.match(runbook, /Do not ask customers to send card details/);
  assert.match(runbook, /Do not ask customers to send GitHub tokens/);
  assert.match(runbook, /per-run cost boundary/);
  assert.match(runbook, /Prompt injection/);
  assert.match(runbook, /High usage/);
  assert.match(runbook, /Accidental key exposure/);
});

test("customer onboarding pack supports manual free and paid provisioning", () => {
  const onboardingPath = join(root, "docs", "customer-onboarding-pack.md");
  assert.equal(existsSync(onboardingPath), true);

  const onboarding = readFileSync(onboardingPath, "utf8");
  assert.match(onboarding, /Free dry-run key reply/);
  assert.match(onboarding, /Paid customer reply/);
  assert.match(onboarding, /GITDOCS_LICENSE_KEY/);
  assert.match(onboarding, /Do not send us API keys/);
  assert.match(onboarding, /Manual customer ledger/);
  assert.match(onboarding, /Support intake/);
});

test("manual customer ledger template captures payment, plan, repo, and support fields", () => {
  const ledgerPath = join(root, "docs", "manual-customer-ledger-template.csv");
  assert.equal(existsSync(ledgerPath), true);

  const ledger = readFileSync(ledgerPath, "utf8");
  assert.match(ledger, /customer_email/);
  assert.match(ledger, /github_repo/);
  assert.match(ledger, /plan/);
  assert.match(ledger, /license_key/);
  assert.match(ledger, /payment_status/);
  assert.match(ledger, /target_languages/);
  assert.match(ledger, /support_notes/);
  assert.match(ledger, /gds_free_/);
});

test("first-customer readiness checklist keeps launch decisions concrete and low-risk", () => {
  const readinessPath = join(root, "docs", "first-customer-readiness.md");
  assert.equal(existsSync(readinessPath), true);

  const readiness = readFileSync(readinessPath, "utf8");
  assert.match(readiness, /Go\/No-Go/);
  assert.match(readiness, /published Action/);
  assert.match(readiness, /live smoke test/);
  assert.match(readiness, /Stripe Payment Links/);
  assert.match(readiness, /pawsitiveme@outlook\.com/);
  assert.match(readiness, /Do not ask customers for API keys/);
  assert.match(readiness, /first 10-30 customers/);
});

test("cold-start distribution assets cover the first launch channels", () => {
  const assetsPath = join(root, "docs", "cold-start-distribution-assets.md");
  assert.equal(existsSync(assetsPath), true);

  const assets = readFileSync(assetsPath, "utf8");
  assert.match(assets, /GitHub Marketplace listing/);
  assert.match(assets, /Docusaurus Awesome List/);
  assert.match(assets, /Show HN/);
  assert.match(assets, /Product Hunt/);
  assert.match(assets, /Reddit/);
  assert.match(assets, /docs consultants/);
  assert.match(assets, /Auto-sync Docusaurus docs translations/);
  assert.match(assets, /SMOKE_TEST_EVIDENCE_URL/);
});

test("payment success pages support Stripe handoff without collecting secrets", () => {
  const enPath = join(root, "site", "payment-success.html");
  const zhPath = join(root, "site", "zh-payment-success.html");
  assert.equal(existsSync(enPath), true);
  assert.equal(existsSync(zhPath), true);

  const en = readFileSync(enPath, "utf8");
  const zh = readFileSync(zhPath, "utf8");
  const sitemap = readFileSync(join(root, "site", "sitemap.xml"), "utf8");

  assert.match(en, /Payment received/);
  assert.match(en, /GitHub repo URL/);
  assert.match(en, /Do not send API keys/);
  assert.match(zh, /付款已收到/);
  assert.match(zh, /GitHub repo URL/);
  assert.match(zh, /不要发送 API key/);
  assert.match(sitemap, /payment-success\.html/);
  assert.match(sitemap, /zh-payment-success\.html/);
});

test("landing page CTAs route visitors to registration or the support email", () => {
  const en = readFileSync(join(root, "site", "index.html"), "utf8");
  const zh = readFileSync(join(root, "site", "zh.html"), "utf8");

  for (const html of [en, zh]) {
    assert.match(html, /href="#register"/);
    assert.match(html, /mailto:pawsitiveme@outlook\.com/);
    assert.doesNotMatch(html, /href=""/);
  }
});

test("site launch checklist explains URL and payment button configuration", () => {
  const checklistPath = join(root, "docs", "site-launch-checklist.md");
  assert.equal(existsSync(checklistPath), true);

  const checklist = readFileSync(checklistPath, "utf8");
  assert.match(checklist, /npm\.cmd run site:url/);
  assert.match(checklist, /npm\.cmd run payment:links/);
  assert.match(checklist, /pawsitiveme@outlook\.com/);
  assert.match(checklist, /HTTPS/);
});

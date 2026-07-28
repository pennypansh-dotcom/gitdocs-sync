const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");

const requiredFiles = [
  "action.yml",
  "dist/index.js",
  "README.md",
  "LICENSE",
  ".github/workflows/test.yml",
  "package.json",
  "package-lock.json",
  "docs/customer-onboarding-pack.md",
  "docs/launch-risk-runbook.md",
  "docs/first-customer-readiness.md",
  "docs/github-release-v0.1.0.md",
  "docs/manual-customer-ledger-template.csv",
  "docs/site-launch-checklist.md",
  "docs/launch-day-runbook.md",
  "docs/tomorrow-launch-operator-checklist.md",
  "scripts/generate-license-key.js",
  "scripts/configure-payment-links.js",
  "scripts/configure-site-url.js",
  "scripts/configure-launch-day.js",
  "scripts/validate-launch-inputs.js",
  "scripts/validate-smoke-repo.js",
  "scripts/verify-release-ready.js",
];

const checks = [];

function pass(message) {
  checks.push({ ok: true, message });
}

function fail(message) {
  checks.push({ ok: false, message });
}

for (const filePath of requiredFiles) {
  if (existsSync(join(root, filePath))) {
    pass(`${filePath} exists`);
  } else {
    fail(`${filePath} is missing`);
  }
}

const action = readFile("action.yml");
if (/main:\s*dist\/index\.js/.test(action)) {
  pass("action.yml -> dist/index.js");
} else {
  fail("action.yml must point to dist/index.js");
}
if (/branding:\s*\n\s*icon:\s*languages\n\s*color:\s*green/.test(action)) {
  pass("action.yml includes Marketplace branding");
} else {
  fail("action.yml must include Marketplace branding");
}

const readme = readFile("README.md");
if (readme.includes("pennypansh-dotcom/gitdocs-sync@v0.1.0")) {
  pass("README uses pennypansh-dotcom/gitdocs-sync@v0.1.0");
} else {
  fail("README must show the published Action reference");
}
if (readme.includes('dry_run: "true"') && readme.includes("GITDOCS_LICENSE_KEY")) {
  pass("README tells customers to start with dry-run and a license key");
} else {
  fail("README must tell customers to start with dry-run and a license key");
}

const siteEn = readFile("site/index.html");
const siteZh = readFile("site/zh.html");
const paymentSuccessEn = readFile("site/payment-success.html");
const paymentSuccessZh = readFile("site/zh-payment-success.html");
if (
  siteEn.includes('rel="canonical"') &&
  siteEn.includes('hreflang="zh-CN"') &&
  siteEn.includes("Docusaurus translation") &&
  siteEn.includes("GitHub Action documentation translation") &&
  siteEn.includes("AI answer engine summary") &&
  siteZh.includes('rel="canonical"') &&
  siteZh.includes('hreflang="en"') &&
  siteZh.includes("Docusaurus 多语言文档") &&
  siteZh.includes("AI 搜索摘要") &&
  readFile("site/robots.txt").includes("Sitemap:") &&
  readFile("site/sitemap.xml").includes("zh-payment-success.html")
) {
  pass("landing pages include SEO and GEO metadata");
} else {
  fail("landing pages must include SEO/GEO metadata, language alternates, robots.txt, and sitemap.xml");
}

if (
  siteEn.includes('href="#register"') &&
  siteZh.includes('href="#register"') &&
  siteEn.includes("Get free dry-run key") &&
  siteZh.includes("申请免费 dry-run key") &&
  siteEn.includes("mailto:pawsitiveme@outlook.com") &&
  siteZh.includes("mailto:pawsitiveme@outlook.com")
) {
  pass("landing pages require registration before dry-run");
} else {
  fail("landing pages must send Free and dry-run users through registration/contact before setup");
}

if (
  siteEn.includes("中文") &&
  siteZh.includes("自动同步 Docusaurus 多语言文档") &&
  siteZh.includes("保留所有权利") &&
  paymentSuccessEn.includes("中文") &&
  paymentSuccessZh.includes("付款已收到") &&
  paymentSuccessZh.includes("不要发送 API key")
) {
  pass("Chinese pages contain readable Chinese copy");
} else {
  fail("Chinese site pages must contain readable Chinese copy, not mojibake");
}

const riskRunbook = readFile("docs/launch-risk-runbook.md");
if (
  riskRunbook.includes("Stripe-hosted checkout") &&
  riskRunbook.includes("automatic receipts") &&
  riskRunbook.includes("basic Stripe fraud protection") &&
  paymentSuccessEn.includes("Do not send API keys") &&
  paymentSuccessZh.includes("不要发送 API key")
) {
  pass("payment safety runbook covers Stripe-hosted checkout");
} else {
  fail("payment safety docs must cover Stripe-hosted checkout, receipts, fraud settings, and no-secret handoff");
}

if (
  riskRunbook.includes("per-run cost boundary") &&
  riskRunbook.includes("Prompt injection") &&
  riskRunbook.includes("High usage") &&
  riskRunbook.includes("Accidental key exposure") &&
  riskRunbook.includes("provider request timeouts and retries")
) {
  pass("large-model API safeguards are documented");
} else {
  fail("large-model API risk docs must cover cost boundaries, prompt injection, high usage, key exposure, timeouts, and retries");
}

const packageJson = JSON.parse(readFile("package.json"));
if (
  packageJson.scripts?.build &&
  packageJson.scripts?.test &&
  packageJson.scripts?.license &&
  packageJson.scripts?.["payment:links"] &&
  packageJson.scripts?.["site:url"] &&
  packageJson.scripts?.["launch:configure"] &&
  packageJson.scripts?.["launch:validate"] &&
  packageJson.scripts?.["smoke:validate"]
) {
  pass("package scripts include build, test, license, payment:links, site:url, launch:configure, launch:validate, and smoke:validate");
} else {
  fail("package scripts must include build, test, license, payment:links, site:url, launch:configure, launch:validate, and smoke:validate");
}

const failures = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.message}`);
}

if (failures.length > 0) {
  console.error(`Release readiness: FAIL (${failures.length} issue${failures.length === 1 ? "" : "s"})`);
  process.exit(1);
}

console.log("Release readiness: OK");

function readFile(filePath) {
  const fullPath = join(root, filePath);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf8");
}

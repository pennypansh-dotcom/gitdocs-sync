const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_OLD_URL = "https://pawsitivetime.com";

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const siteDir = args["site-dir"] || join(__dirname, "..", "site");
  const siteUrl = normalizeSiteUrl(args.url || process.env.GITDOCS_SITE_URL);
  const oldUrl = normalizeSiteUrl(args["old-url"] || DEFAULT_OLD_URL);
  const files = ["index.html", "zh.html", "payment-success.html", "zh-payment-success.html", "sitemap.xml", "robots.txt"];

  for (const fileName of files) {
    const filePath = join(siteDir, fileName);
    if (!existsSync(filePath)) {
      throw new Error(`Missing site file: ${filePath}`);
    }
    const next = readFileSync(filePath, "utf8").replaceAll(oldUrl, siteUrl);
    writeFileSync(filePath, next, "utf8");
  }

  return `Site URL configured: ${siteUrl}`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Usage: node scripts/configure-site-url.js --url https://example.com");
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function normalizeSiteUrl(value) {
  if (!value || !/^https:\/\//.test(value)) {
    throw new Error("Site URL must use HTTPS.");
  }
  return value.replace(/\/+$/, "");
}

if (require.main === module) {
  try {
    console.log(main());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, normalizeSiteUrl };

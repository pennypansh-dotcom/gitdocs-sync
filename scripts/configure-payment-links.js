const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const siteDir = args["site-dir"] || join(__dirname, "..", "site");
  const proUrl = args["pro-url"] || process.env.GITDOCS_PRO_PAYMENT_URL;
  const teamUrl = args["team-url"] || process.env.GITDOCS_TEAM_PAYMENT_URL;

  validatePaymentUrl(proUrl);
  validatePaymentUrl(teamUrl);

  for (const fileName of ["index.html", "zh.html"]) {
    const filePath = join(siteDir, fileName);
    if (!existsSync(filePath)) {
      throw new Error(`Missing site file: ${filePath}`);
    }
    let html = readFileSync(filePath, "utf8");
    html = replacePlanHref(html, "pro", proUrl);
    html = replacePlanHref(html, "team", teamUrl);
    writeFileSync(filePath, html, "utf8");
  }

  return "Payment links configured for Pro and Team.";
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Usage: node scripts/configure-payment-links.js --pro-url https://... --team-url https://...");
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function validatePaymentUrl(value) {
  if (!value || !/^https:\/\//.test(value)) {
    throw new Error("Payment links must use HTTPS.");
  }
}

function replacePlanHref(html, plan, url) {
  const pattern = new RegExp(`(data-plan-link="${plan}"\\s+href=")[^"]*(")`, "g");
  const next = html.replace(pattern, `$1${url}$2`);
  if (next === html) {
    throw new Error(`Could not find ${plan} payment link marker.`);
  }
  return next;
}

if (require.main === module) {
  try {
    console.log(main());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs, replacePlanHref };

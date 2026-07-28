const { main: configureSiteUrl } = require("./configure-site-url");
const { main: configurePaymentLinks } = require("./configure-payment-links");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const siteDir = args["site-dir"];

  const siteArgs = [];
  if (siteDir) {
    siteArgs.push("--site-dir", siteDir);
  }
  siteArgs.push("--url", args.url || process.env.GITDOCS_SITE_URL);
  configureSiteUrl(siteArgs);

  const paymentArgs = [];
  if (siteDir) {
    paymentArgs.push("--site-dir", siteDir);
  }
  paymentArgs.push("--pro-url", args["pro-url"] || process.env.GITDOCS_PRO_PAYMENT_URL);
  paymentArgs.push("--team-url", args["team-url"] || process.env.GITDOCS_TEAM_PAYMENT_URL);
  configurePaymentLinks(paymentArgs);

  return "Launch day site and payment buttons configured.";
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Usage: node scripts/configure-launch-day.js --url https://... --pro-url https://... --team-url https://...");
    }
    args[key.slice(2)] = value;
  }
  return args;
}

if (require.main === module) {
  try {
    console.log(main());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs };

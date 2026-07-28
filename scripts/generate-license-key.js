const { randomBytes } = require("node:crypto");

const VALID_PLANS = new Set(["free", "pro", "team"]);

function main(argv = process.argv.slice(2), env = process.env) {
  const [planInput, customerInput] = argv;
  const plan = String(planInput || "").toLowerCase();
  if (!VALID_PLANS.has(plan)) {
    throw new Error("plan must be one of: free, pro, team");
  }

  const customer = slugify(customerInput || "customer");
  const date = normaliseDate(env.GITDOCS_LICENSE_DATE);
  const suffix = randomBytes(6).toString("hex");
  return `gds_${plan}_${date}_${customer}_${suffix}`;
}

function normaliseDate(value) {
  if (value && /^\d{6}$/.test(value)) return value;
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function slugify(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "customer";
}

if (require.main === module) {
  try {
    console.log(main());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, slugify };

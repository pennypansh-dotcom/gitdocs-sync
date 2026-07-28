function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const url = normalizeHttpsUrl(args.url || process.env.GITDOCS_SITE_URL, "site URL");
  const proUrl = normalizeHttpsUrl(args["pro-url"] || process.env.GITDOCS_PRO_PAYMENT_URL, "Pro payment URL");
  const teamUrl = normalizeHttpsUrl(args["team-url"] || process.env.GITDOCS_TEAM_PAYMENT_URL, "Team payment URL");
  const repo = normalizeRepoSlug(args.repo || process.env.GITDOCS_REPOSITORY);
  const smokeRepo = normalizeRepoSlug(args["smoke-repo"] || process.env.GITDOCS_SMOKE_REPOSITORY);

  return [
    "Launch inputs validated.",
    `Site URL: ${url}`,
    `Pro payment URL: ${proUrl}`,
    `Team payment URL: ${teamUrl}`,
    `Repo: ${repo}`,
    `Smoke repo: ${smokeRepo}`,
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(
        "Usage: node scripts/validate-launch-inputs.js --url https://... --pro-url https://... --team-url https://... --repo owner/repo --smoke-repo owner/repo",
      );
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function normalizeHttpsUrl(value, label) {
  if (!value || !/^https:\/\//.test(value)) {
    throw new Error(`${label} must use HTTPS.`);
  }
  return value.replace(/\/+$/, "");
}

function normalizeRepoSlug(value) {
  const slug = String(value || "").trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(slug)) {
    throw new Error("Repository slug must be owner/repo.");
  }
  return slug;
}

if (require.main === module) {
  try {
    console.log(main());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, normalizeHttpsUrl, normalizeRepoSlug, parseArgs };

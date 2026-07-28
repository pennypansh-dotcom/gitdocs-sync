const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const yaml = require("js-yaml");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const repoDir = args["repo-dir"] || join(__dirname, "..");
  const workflowPath = join(repoDir, ".github", "workflows", "gitdocs-sync.yml");
  const configPath = join(repoDir, ".gitdocs-sync.yml");

  if (!existsSync(workflowPath)) {
    throw new Error(`Missing workflow file: ${workflowPath}`);
  }
  if (!existsSync(configPath)) {
    throw new Error(`Missing config file: ${configPath}`);
  }

  const workflow = readFileSync(workflowPath, "utf8");
  const config = readFileSync(configPath, "utf8");
  const actionRef = assertPublishedAction(workflow);
  assertLiveWorkflow(workflow);
  const smokeConfig = assertSmokeConfig(config);

  return [
    "Smoke repo validated.",
    `Action: ${actionRef}`,
    `source_lang: ${smokeConfig.source_lang}`,
    `target_langs: ${smokeConfig.target_langs.join(", ")}`,
    `dry_run: ${smokeConfig.dry_run}`,
    `Workflow: ${workflowPath}`,
    `Config: ${configPath}`,
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Usage: node scripts/validate-smoke-repo.js --repo-dir path/to/repo");
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function assertPublishedAction(workflow) {
  const match = workflow.match(/uses:\s+([^\s#]+pennypansh-dotcom\/gitdocs-sync@v0\.1\.0|pennypansh-dotcom\/gitdocs-sync@v0\.1\.0)/);
  if (!match) {
    throw new Error("Smoke repo must use the published Action reference instead of a local path.");
  }
  if (/uses:\s+\.\//.test(workflow)) {
    throw new Error("Smoke repo must not use uses: ./ for the commercial smoke test.");
  }
  return match[1];
}

function assertLiveWorkflow(workflow) {
  if (!workflow.includes("GITDOCS_LICENSE_KEY")) {
    throw new Error("Smoke repo workflow must pass GITDOCS_LICENSE_KEY from GitHub secrets.");
  }
  if (/dry_run:\s*["']?true["']?/i.test(workflow)) {
    throw new Error('Smoke repo workflow should use dry_run: "false" for live smoke.');
  }
  if (!/dry_run:\s*["']?false["']?/i.test(workflow)) {
    throw new Error('Smoke repo workflow should explicitly set dry_run: "false" for live smoke.');
  }
}

function assertSmokeConfig(config) {
  let parsed;
  try {
    parsed = yaml.load(config) || {};
  } catch (error) {
    throw new Error(`Smoke repo config is not valid YAML: ${error.message}`);
  }

  if (parsed.source_lang !== "en") {
    throw new Error("Smoke repo config should use source_lang: en.");
  }
  if (!Array.isArray(parsed.target_langs) || !parsed.target_langs.includes("zh")) {
    throw new Error("Smoke repo config should include zh as the target language.");
  }
  if (parsed.dry_run !== false) {
    throw new Error("Smoke repo config should use dry_run: false for live smoke.");
  }
  return parsed;
}

if (require.main === module) {
  try {
    console.log(main());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, assertPublishedAction, assertLiveWorkflow, assertSmokeConfig, parseArgs };

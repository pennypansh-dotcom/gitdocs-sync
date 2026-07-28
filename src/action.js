const { readFileSync } = require("node:fs");
const { runGitDocsSync } = require("./gitdocs-sync");
const { createGitHubApiAdapter } = require("./github-api");
const { createDeepSeekProvider, createOpenAIProvider, createProviderRouter } = require("./providers");

async function main() {
  const repoDir = process.cwd();
  const event = readGitHubEventFromFile(process.env.GITHUB_EVENT_NAME || "workflow_dispatch", process.env.GITHUB_EVENT_PATH);
  applyActionInputs();
  const license = parseLicenseKey(requireLicenseKeyFromEnv());
  process.env.GITDOCS_PLAN = license.plan;
  const github = createGitHubAdapterFromEnv();
  const translator = createTranslatorFromEnv();
  const result = await runGitDocsSync({ repoDir, github, translator, event });
  console.log(`GitDocs Sync finished: ${result.status}`);
}

function applyActionInputs() {
  if (process.env.INPUT_DRY_RUN === "true") {
    process.env.GITDOCS_DRY_RUN = "true";
  }
}

function readGitHubEventFromFile(eventName, eventPath) {
  if (!eventPath) return { name: eventName };
  const payload = JSON.parse(readFileSync(eventPath, "utf8"));
  if (eventName === "issue_comment") {
    return {
      name: "issue_comment",
      issue: {
        number: payload.issue.number,
        title: payload.issue.title,
        labels: (payload.issue.labels || []).map((label) => label.name),
      },
      comment: { body: payload.comment.body, user: payload.comment.user.login },
    };
  }
  if (eventName === "push") {
    const commits = payload.commits?.length ? payload.commits : payload.head_commit ? [payload.head_commit] : [];
    return {
      name: "push",
      changedFiles: unique(
        commits.flatMap((commit) => [
          ...(commit.added || []),
          ...(commit.modified || []),
          ...(commit.removed || []),
        ]),
      ),
    };
  }
  if (eventName === "pull_request") {
    return {
      name: "pull_request.closed",
      pullRequest: {
        merged: Boolean(payload.pull_request?.merged),
        number: payload.pull_request?.number,
        url: payload.pull_request?.html_url,
        labels: (payload.pull_request?.labels || []).map((label) => label.name),
      },
    };
  }
  return { name: eventName };
}

function createGitHubAdapterFromEnv() {
  const repository = process.env.GITHUB_REPOSITORY || "";
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error("GitDocs Sync needs the GitHub repository name. Run it inside GitHub Actions or set GITHUB_REPOSITORY like owner/repo.");
  }
  const token = process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Pass github_token: ${{ secrets.GITHUB_TOKEN }} in the workflow so GitDocs Sync can create Issues and PRs.");
  }
  return createGitHubApiAdapter({ owner, repo, token });
}

function createTranslatorFromEnv() {
  return createProviderRouter({
    deepseek: process.env.DEEPSEEK_API_KEY
      ? createDeepSeekProvider({
          apiKey: process.env.DEEPSEEK_API_KEY,
          baseUrl: process.env.DEEPSEEK_BASE_URL,
          model: process.env.DEEPSEEK_MODEL,
        })
      : undefined,
    openai: process.env.OPENAI_API_KEY
      ? createOpenAIProvider({
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL,
          model: process.env.OPENAI_MODEL,
        })
      : undefined,
  });
}

function requireLicenseKeyFromEnv() {
  const licenseKey = process.env.INPUT_LICENSE_KEY || process.env.GITDOCS_LICENSE_KEY;
  if (!licenseKey) {
    throw new Error("Register for a free GitDocs Sync key before running dry-run or translation work. Add it as GITDOCS_LICENSE_KEY in GitHub Secrets, then pass it through the workflow.");
  }
  return licenseKey;
}

function parseLicenseKey(licenseKey) {
  const match = String(licenseKey).match(/^gds_(free|pro|team)_([0-9]{6})_([a-z0-9-]+)_([a-f0-9]{12})$/);
  if (!match) {
    throw new Error("Invalid GitDocs Sync license key. Register for a free key or check that GITDOCS_LICENSE_KEY was copied correctly.");
  }
  return {
    plan: match[1],
    issuedMonth: match[2],
    customer: match[3],
  };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(formatActionError(error));
    process.exitCode = 1;
  });
}

function formatActionError(error) {
  return error?.stack || error?.message || String(error);
}

function unique(values) {
  return [...new Set(values)];
}

module.exports = { createGitHubAdapterFromEnv, formatActionError, parseLicenseKey, readGitHubEventFromFile, requireLicenseKeyFromEnv };

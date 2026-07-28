const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");

const {
  checkRevocation,
  createGitHubAdapterFromEnv,
  formatActionError,
  parseLicenseKey,
  readGitHubEventFromFile,
  requireLicenseKeyFromEnv,
} = require("../src/action");

test("action maps issue_comment payload to internal event", () => {
  const dir = mkdtempSync(join(tmpdir(), "gitdocs-action-"));
  const eventPath = join(dir, "event.json");
  writeFileSync(
    eventPath,
    JSON.stringify({
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: { login: "maintainer" } },
    }),
    "utf8",
  );

  const event = readGitHubEventFromFile("issue_comment", eventPath);

  assert.deepEqual(event, {
    name: "issue_comment",
    issue: { number: 7, title: "[GitDocs Sync] Translation sync audit", labels: [] },
    comment: { body: "/gitdocs sync zh", user: "maintainer" },
  });
});

test("action maps issue labels for idempotent audit commands", () => {
  const dir = mkdtempSync(join(tmpdir(), "gitdocs-action-"));
  const eventPath = join(dir, "event.json");
  writeFileSync(
    eventPath,
    JSON.stringify({
      issue: {
        number: 7,
        title: "[GitDocs Sync] Translation sync audit",
        labels: [{ name: "gitdocs-sync-decided" }],
      },
      comment: { body: "/gitdocs sync zh", user: { login: "maintainer" } },
    }),
    "utf8",
  );

  const event = readGitHubEventFromFile("issue_comment", eventPath);

  assert.deepEqual(event.issue.labels, ["gitdocs-sync-decided"]);
});

test("action maps push payload to changed docs", () => {
  const dir = mkdtempSync(join(tmpdir(), "gitdocs-action-"));
  const eventPath = join(dir, "event.json");
  writeFileSync(
    eventPath,
    JSON.stringify({
      commits: [
        { added: ["docs/intro.md"], modified: ["README.md"], removed: [] },
        { added: [], modified: ["docs/guide.md"], removed: ["docs/old.md"] },
      ],
    }),
    "utf8",
  );

  const event = readGitHubEventFromFile("push", eventPath);

  assert.deepEqual(event, {
    name: "push",
    changedFiles: ["docs/intro.md", "README.md", "docs/guide.md", "docs/old.md"],
  });
});

test("action maps push payload from head_commit when commits are unavailable", () => {
  const dir = mkdtempSync(join(tmpdir(), "gitdocs-action-"));
  const eventPath = join(dir, "event.json");
  writeFileSync(
    eventPath,
    JSON.stringify({
      commits: [],
      head_commit: {
        added: [],
        modified: ["docs/intro.md"],
        removed: [],
      },
    }),
    "utf8",
  );

  const event = readGitHubEventFromFile("push", eventPath);

  assert.deepEqual(event, {
    name: "push",
    changedFiles: ["docs/intro.md"],
  });
});

test("action explains when repository context is missing", () => {
  const previousRepository = process.env.GITHUB_REPOSITORY;
  const previousToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REPOSITORY;
  process.env.GITHUB_TOKEN = "token";

  try {
    assert.throws(
      () => createGitHubAdapterFromEnv(),
      /GitDocs Sync needs the GitHub repository name/,
    );
  } finally {
    restoreEnv("GITHUB_REPOSITORY", previousRepository);
    restoreEnv("GITHUB_TOKEN", previousToken);
  }
});

test("action explains when github token is missing", () => {
  const previousRepository = process.env.GITHUB_REPOSITORY;
  const previousGithubToken = process.env.GITHUB_TOKEN;
  const previousInputToken = process.env.INPUT_GITHUB_TOKEN;
  process.env.GITHUB_REPOSITORY = "acme/docs";
  delete process.env.GITHUB_TOKEN;
  delete process.env.INPUT_GITHUB_TOKEN;

  try {
    assert.throws(
      () => createGitHubAdapterFromEnv(),
      /Pass github_token/,
    );
  } finally {
    restoreEnv("GITHUB_REPOSITORY", previousRepository);
    restoreEnv("GITHUB_TOKEN", previousGithubToken);
    restoreEnv("INPUT_GITHUB_TOKEN", previousInputToken);
  }
});

test("action explains when license key is missing before any dry-run or translation work", () => {
  const previousLicense = process.env.GITDOCS_LICENSE_KEY;
  const previousInputLicense = process.env.INPUT_LICENSE_KEY;
  delete process.env.GITDOCS_LICENSE_KEY;
  delete process.env.INPUT_LICENSE_KEY;

  try {
    assert.throws(
      () => requireLicenseKeyFromEnv(),
      /Register for a free GitDocs Sync key/,
    );
  } finally {
    restoreEnv("GITDOCS_LICENSE_KEY", previousLicense);
    restoreEnv("INPUT_LICENSE_KEY", previousInputLicense);
  }
});

test("action accepts a license key from GitHub secrets or Action inputs", () => {
  const previousLicense = process.env.GITDOCS_LICENSE_KEY;
  const previousInputLicense = process.env.INPUT_LICENSE_KEY;
  delete process.env.GITDOCS_LICENSE_KEY;
  process.env.INPUT_LICENSE_KEY = "gds_free_example";

  try {
    assert.equal(requireLicenseKeyFromEnv(), "gds_free_example");
  } finally {
    restoreEnv("GITDOCS_LICENSE_KEY", previousLicense);
    restoreEnv("INPUT_LICENSE_KEY", previousInputLicense);
  }
});

test("action parses the launch plan from a manual license key", () => {
  assert.equal(parseLicenseKey("gds_free_202607_acme-docs_abcdef123456").plan, "free");
  assert.equal(parseLicenseKey("gds_pro_202607_acme-docs_abcdef123456").plan, "pro");
  assert.equal(parseLicenseKey("gds_team_202607_acme-docs_abcdef123456").plan, "team");
});

test("action rejects malformed manual license keys", () => {
  assert.throws(
    () => parseLicenseKey("not-a-gitdocs-key"),
    /Invalid GitDocs Sync license key/,
  );
});

test("action error output includes stack context when available", () => {
  const error = new Error("GitHub request failed");
  error.stack = "Error: GitHub request failed\n    at useful-frame";

  assert.match(formatActionError(error), /useful-frame/);
});

test("published GitHub Action points at the bundled dist entrypoint", () => {
  const actionYaml = readFileSync(join(__dirname, "..", "action.yml"), "utf8");

  assert.match(actionYaml, /main:\s+dist\/index\.js/);
});

test("published GitHub Action includes Marketplace branding metadata", () => {
  const actionYaml = readFileSync(join(__dirname, "..", "action.yml"), "utf8");

  assert.match(actionYaml, /branding:/);
  assert.match(actionYaml, /icon:\s+languages/);
  assert.match(actionYaml, /color:\s+green/);
  assert.match(actionYaml, /Auto-sync Docusaurus docs translations/);
});

test("checkRevocation throws when key is in revoked list", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { revoked_keys: ["gds_pro_202607_acme_abc123def456"] };
    },
  });
  try {
    await assert.rejects(
      checkRevocation("gds_pro_202607_acme_abc123def456"),
      /revoked/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkRevocation passes when key is not in revoked list", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { revoked_keys: ["gds_pro_202607_other_abc123def456"] };
    },
  });
  try {
    await checkRevocation("gds_pro_202607_acme_abc123def456");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkRevocation passes when fetch fails (network tolerance)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Network error");
  };
  try {
    await checkRevocation("gds_pro_202607_acme_abc123def456");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkRevocation passes when revoked list is empty", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { revoked_keys: [] };
    },
  });
  try {
    await checkRevocation("gds_pro_202607_acme_abc123def456");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

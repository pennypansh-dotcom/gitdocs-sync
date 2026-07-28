const assert = require("node:assert/strict");
const test = require("node:test");

const { createGitHubApiAdapter } = require("../src/github-api");

function createFetchRecorder(routes) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || "GET",
      body: options.body ? JSON.parse(options.body) : undefined,
      signal: options.signal,
    });
    const route = routes.shift();
    assert.ok(route, `Unexpected request: ${options.method || "GET"} ${url}`);
    assert.equal(String(url), route.url);
    assert.equal(options.method || "GET", route.method || "GET");
    return {
      ok: route.ok ?? true,
      status: route.status || 200,
      async json() {
        return route.json;
      },
      async text() {
        return JSON.stringify(route.json);
      },
    };
  };
  return { fetch, calls };
}

test("upsertIssue updates an existing open GitDocs Sync issue", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/issues?state=open&labels=gitdocs-sync&per_page=100&page=1",
      json: [{ number: 42, title: "[GitDocs Sync] Translation sync audit" }],
    },
    {
      method: "PATCH",
      url: "https://api.github.com/repos/acme/docs/issues/42",
      json: { number: 42, html_url: "https://github.com/acme/docs/issues/42" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch });

  const issue = await github.upsertIssue({
    title: "[GitDocs Sync] Translation sync audit",
    body: "Audit body",
  });

  assert.equal(issue.number, 42);
  assert.equal(issue.url, "https://github.com/acme/docs/issues/42");
  assert.equal(calls[1].body.body, "Audit body");
  assert.deepEqual(calls[1].body.labels, ["gitdocs-sync"]);
});

test("upsertIssue creates a new GitDocs Sync issue when none exists", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/issues?state=open&labels=gitdocs-sync&per_page=100&page=1",
      json: [],
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/issues",
      json: { number: 7, html_url: "https://github.com/acme/docs/issues/7" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch });

  const issue = await github.upsertIssue({
    title: "[GitDocs Sync] Translation sync audit",
    body: "Audit body",
  });

  assert.equal(issue.number, 7);
  assert.equal(calls[1].body.title, "[GitDocs Sync] Translation sync audit");
  assert.equal(calls[1].body.body, "Audit body");
  assert.deepEqual(calls[1].body.labels, ["gitdocs-sync"]);
});

test("upsertIssue retries transient GitHub failures", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/issues?state=open&labels=gitdocs-sync&per_page=100&page=1",
      ok: false,
      status: 503,
      json: { message: "Service unavailable" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/issues?state=open&labels=gitdocs-sync&per_page=100&page=1",
      json: [],
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/issues",
      json: { number: 7, html_url: "https://github.com/acme/docs/issues/7" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch });

  const issue = await github.upsertIssue({ title: "[GitDocs Sync] Translation sync audit", body: "Audit body" });

  assert.equal(issue.number, 7);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "GET", "POST"]);
});

test("upsertIssue searches paginated GitHub issues before creating a new audit issue", async () => {
  const firstPage = Array.from({ length: 100 }, (_unused, index) => ({ number: index + 1, title: `Other issue ${index + 1}` }));
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/issues?state=open&labels=gitdocs-sync&per_page=100&page=1",
      json: firstPage,
    },
    {
      url: "https://api.github.com/repos/acme/docs/issues?state=open&labels=gitdocs-sync&per_page=100&page=2",
      json: [{ number: 142, title: "[GitDocs Sync] Translation sync audit" }],
    },
    {
      method: "PATCH",
      url: "https://api.github.com/repos/acme/docs/issues/142",
      json: { number: 142, html_url: "https://github.com/acme/docs/issues/142" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch });

  const issue = await github.upsertIssue({ title: "[GitDocs Sync] Translation sync audit", body: "Audit body" });

  assert.equal(issue.number, 142);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "GET", "PATCH"]);
});

test("getUserPermission returns collaborator permission", async () => {
  const { fetch } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/collaborators/alice/permission",
      json: { permission: "write" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch });

  assert.equal(await github.getUserPermission("alice"), "write");
});

test("replyToIssue posts a comment to the issue", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/issues/42/comments",
      json: { id: 99, html_url: "https://github.com/acme/docs/issues/42#issuecomment-99" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch });

  await github.replyToIssue(42, "Need repo write permission.");

  assert.equal(calls[0].body.body, "Need repo write permission.");
});

test("addIssueLabels marks an audit issue as decided", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/issues/42/labels",
      json: [{ name: "gitdocs-sync-decided" }],
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch });

  await github.addIssueLabels(42, ["gitdocs-sync-decided"]);

  assert.deepEqual(calls[0].body.labels, ["gitdocs-sync-decided"]);
});

test("createPullRequest creates a branch, writes files, and opens a PR", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/git/ref/heads/main",
      json: { object: { sha: "base-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      json: { ref: "refs/heads/gitdocs-sync/test-branch" },
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      json: { content: { sha: "file-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/pulls",
      json: { number: 12, html_url: "https://github.com/acme/docs/pull/12" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  const pullRequest = await github.createPullRequest({
    branch: "gitdocs-sync/test-branch",
    title: "[GitDocs Sync] Update zh docs (1 files)",
    body: "PR body",
    files: {
      "i18n/zh/intro.md": "# Intro\n\n你好",
    },
  });

  assert.equal(pullRequest.number, 12);
  assert.equal(pullRequest.url, "https://github.com/acme/docs/pull/12");
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "PUT", "POST"]);
  assert.equal(calls[1].body.sha, "base-sha");
  assert.equal(calls[2].body.branch, "gitdocs-sync/test-branch");
  assert.equal(Buffer.from(calls[2].body.content, "base64").toString("utf8"), "# Intro\n\n你好");
  assert.equal(calls[3].body.head, "gitdocs-sync/test-branch");
  assert.equal(calls[3].body.base, "main");
});

test("createPullRequest creates a fresh branch instead of force-resetting an existing branch with no open PR", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/git/ref/heads/main",
      json: { object: { sha: "base-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      ok: false,
      status: 422,
      json: { message: "Reference already exists" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/pulls?state=open&head=acme%3Agitdocs-sync%2Fen-to-zh",
      json: [],
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      json: { ref: "refs/heads/gitdocs-sync/en-to-zh", object: { sha: "base-sha" } },
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      json: { content: { sha: "file-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/pulls",
      json: { number: 12, html_url: "https://github.com/acme/docs/pull/12" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  const pullRequest = await github.createPullRequest({
    branch: "gitdocs-sync/en-to-zh",
    title: "[GitDocs Sync] Update zh docs (1 files)",
    body: "PR body",
    files: { "i18n/zh/intro.md": "# Intro" },
  });

  assert.equal(pullRequest.number, 12);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "GET", "POST", "PUT", "POST"]);
  assert.match(calls[3].body.ref, /^refs\/heads\/gitdocs-sync\/en-to-zh-/);
  assert.equal(calls[3].body.sha, "base-sha");
  assert.equal(calls[4].body.branch, calls[3].body.ref.replace("refs/heads/", ""));
  assert.equal(calls[5].body.head, calls[3].body.ref.replace("refs/heads/", ""));
});

test("createPullRequest reuses the deterministic fresh branch PR after the stable branch was left behind", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/git/ref/heads/main",
      json: { object: { sha: "abcdef1234567890" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      ok: false,
      status: 422,
      json: { message: "Reference already exists" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/pulls?state=open&head=acme%3Agitdocs-sync%2Fen-to-zh",
      json: [],
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      ok: false,
      status: 422,
      json: { message: "Reference already exists" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/pulls?state=open&head=acme%3Agitdocs-sync%2Fen-to-zh-abcdef1",
      json: [{ number: 15, html_url: "https://github.com/acme/docs/pull/15" }],
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      json: { content: { sha: "file-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/pulls",
      ok: false,
      status: 422,
      json: { message: "Validation Failed", errors: [{ message: "A pull request already exists" }] },
    },
    {
      url: "https://api.github.com/repos/acme/docs/pulls?state=open&head=acme%3Agitdocs-sync%2Fen-to-zh-abcdef1",
      json: [{ number: 15, html_url: "https://github.com/acme/docs/pull/15" }],
    },
    {
      method: "PATCH",
      url: "https://api.github.com/repos/acme/docs/pulls/15",
      json: { number: 15, html_url: "https://github.com/acme/docs/pull/15" },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/issues/15/comments",
      json: { id: 99, html_url: "https://github.com/acme/docs/pull/15#issuecomment-99" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  const pullRequest = await github.createPullRequest({
    branch: "gitdocs-sync/en-to-zh",
    title: "[GitDocs Sync] Update zh docs (1 files)",
    body: "PR body",
    files: { "i18n/zh/intro.md": "# Intro" },
  });

  assert.equal(pullRequest.number, 15);
  assert.equal(pullRequest.reused, true);
  assert.equal(calls[5].body.branch, "gitdocs-sync/en-to-zh-abcdef1");
  assert.equal(calls[8].body.body, "PR body");
});

test("createPullRequest updates an existing open PR when GitHub rejects a duplicate PR", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/git/ref/heads/main",
      json: { object: { sha: "base-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      ok: false,
      status: 422,
      json: { message: "Reference already exists" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/pulls?state=open&head=acme%3Agitdocs-sync%2Fen-to-zh",
      json: [{ number: 12, html_url: "https://github.com/acme/docs/pull/12" }],
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      json: { content: { sha: "file-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/pulls",
      ok: false,
      status: 422,
      json: { message: "Validation Failed", errors: [{ message: "A pull request already exists" }] },
    },
    {
      url: "https://api.github.com/repos/acme/docs/pulls?state=open&head=acme%3Agitdocs-sync%2Fen-to-zh",
      json: [{ number: 12, html_url: "https://github.com/acme/docs/pull/12" }],
    },
    {
      method: "PATCH",
      url: "https://api.github.com/repos/acme/docs/pulls/12",
      json: { number: 12, html_url: "https://github.com/acme/docs/pull/12" },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/issues/12/comments",
      json: { id: 99, html_url: "https://github.com/acme/docs/pull/12#issuecomment-99" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  const pullRequest = await github.createPullRequest({
    branch: "gitdocs-sync/en-to-zh",
    title: "[GitDocs Sync] Update zh docs (1 files)",
    body: "Fresh PR body",
    files: { "i18n/zh/intro.md": "# Intro" },
  });

  assert.equal(pullRequest.number, 12);
  assert.equal(pullRequest.reused, true);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "GET", "PUT", "POST", "GET", "PATCH", "POST"]);
  assert.equal(calls[6].body.body, "Fresh PR body");
  assert.match(calls[7].body.body, /updated this PR/);
});

test("createPullRequest retries file updates with the existing file sha when GitHub requires it", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/git/ref/heads/main",
      json: { object: { sha: "base-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      ok: false,
      status: 422,
      json: { message: "Reference already exists" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/pulls?state=open&head=acme%3Agitdocs-sync%2Fen-to-zh",
      json: [{ number: 12, html_url: "https://github.com/acme/docs/pull/12" }],
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      ok: false,
      status: 422,
      json: { message: "sha wasn't supplied" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md?ref=gitdocs-sync%2Fen-to-zh",
      json: { sha: "existing-file-sha" },
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      json: { content: { sha: "new-file-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/pulls",
      json: { number: 12, html_url: "https://github.com/acme/docs/pull/12" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  const pullRequest = await github.createPullRequest({
    branch: "gitdocs-sync/en-to-zh",
    title: "[GitDocs Sync] Update zh docs (1 files)",
    body: "PR body",
    files: { "i18n/zh/intro.md": "# Intro" },
  });

  assert.equal(pullRequest.number, 12);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "GET", "PUT", "GET", "PUT", "POST"]);
  assert.equal(calls[5].body.sha, "existing-file-sha");
});

test("createPullRequest stops after a second sha conflict instead of recursing forever", async () => {
  const { fetch } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/git/ref/heads/main",
      json: { object: { sha: "base-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      json: { ref: "refs/heads/gitdocs-sync/en-to-zh" },
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      ok: false,
      status: 422,
      json: { message: "sha wasn't supplied" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md?ref=gitdocs-sync%2Fen-to-zh",
      json: { sha: "existing-file-sha" },
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      ok: false,
      status: 422,
      json: { message: "sha does not match" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  await assert.rejects(
    () => github.createPullRequest({
      branch: "gitdocs-sync/en-to-zh",
      title: "[GitDocs Sync] Update zh docs (1 files)",
      body: "PR body",
      files: { "i18n/zh/intro.md": "# Intro" },
    }),
    /sha does not match/,
  );
});

test("createPullRequest applies labels to the PR issue when labels are provided", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/git/ref/heads/main",
      json: { object: { sha: "base-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      json: { ref: "refs/heads/gitdocs-sync/en-to-zh" },
    },
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fintro.md",
      json: { content: { sha: "file-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/pulls",
      json: { number: 12, html_url: "https://github.com/acme/docs/pull/12" },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/issues/12/labels",
      json: [{ name: "gitdocs-sync" }, { name: "lang:zh" }],
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  const pullRequest = await github.createPullRequest({
    branch: "gitdocs-sync/en-to-zh",
    title: "[GitDocs Sync] Update zh docs (1 files)",
    body: "PR body",
    labels: ["gitdocs-sync", "lang:zh"],
    files: { "i18n/zh/intro.md": "# Intro" },
  });

  assert.equal(pullRequest.number, 12);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "PUT", "POST", "POST"]);
  assert.deepEqual(calls[4].body.labels, ["gitdocs-sync", "lang:zh"]);
});

test("createPullRequest deletes files when a file entry is null", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/git/ref/heads/main",
      json: { object: { sha: "base-sha" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/git/refs",
      json: { ref: "refs/heads/gitdocs-sync/en-to-zh" },
    },
    {
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fold.md?ref=gitdocs-sync%2Fen-to-zh",
      json: { sha: "old-file-sha" },
    },
    {
      method: "DELETE",
      url: "https://api.github.com/repos/acme/docs/contents/i18n%2Fzh%2Fold.md",
      json: { commit: { sha: "delete-commit" } },
    },
    {
      method: "POST",
      url: "https://api.github.com/repos/acme/docs/pulls",
      json: { number: 12, html_url: "https://github.com/acme/docs/pull/12" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  await github.createPullRequest({
    branch: "gitdocs-sync/en-to-zh",
    title: "[GitDocs Sync] Delete removed zh docs (1 files)",
    body: "PR body",
    files: { "i18n/zh/old.md": null },
  });

  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "GET", "DELETE", "POST"]);
  assert.equal(calls[3].body.branch, "gitdocs-sync/en-to-zh");
  assert.equal(calls[3].body.sha, "old-file-sha");
});

test("commitFiles writes files to the base branch", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      method: "PUT",
      url: "https://api.github.com/repos/acme/docs/contents/.gitdocs-sync%2Ftm%2Fen-zh.json",
      json: { content: { sha: "tm-sha" } },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, baseBranch: "main" });

  await github.commitFiles({
    title: "[GitDocs Sync] Update zh Translation Memory",
    files: { ".gitdocs-sync/tm/en-zh.json": "{\"records\":[]}\n" },
  });

  assert.equal(calls[0].body.branch, "main");
  assert.equal(calls[0].body.message, "[GitDocs Sync] Update zh Translation Memory: .gitdocs-sync/tm/en-zh.json");
});

test("GitHub requests include an abort signal so Actions do not hang forever", async () => {
  const { fetch, calls } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/collaborators/alice/permission",
      json: { permission: "write" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch, timeoutMs: 100 });

  assert.equal(await github.getUserPermission("alice"), "write");
  assert.ok(calls[0].signal);
});

test("GitHub error messages redact token-like values from response bodies", async () => {
  const { fetch } = createFetchRecorder([
    {
      url: "https://api.github.com/repos/acme/docs/collaborators/alice/permission",
      ok: false,
      status: 403,
      json: { message: "bad token ghp_abcdefghijklmnopqrstuvwxyz1234567890" },
    },
  ]);
  const github = createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "token", fetch });

  await assert.rejects(
    () => github.getUserPermission("alice"),
    (error) => {
      assert.match(error.message, /\[REDACTED\]/);
      assert.doesNotMatch(error.message, /ghp_abcdefghijklmnopqrstuvwxyz/);
      return true;
    },
  );
});

test("createGitHubApiAdapter fails early when github token is missing", async () => {
  assert.throws(
    () => createGitHubApiAdapter({ owner: "acme", repo: "docs", token: "" }),
    /GitDocs Sync needs a GitHub token/,
  );
});

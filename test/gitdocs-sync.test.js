const assert = require("node:assert/strict");
const { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");

const { runGitDocsSync } = require("../src/gitdocs-sync");

function createRepo(files) {
  const repoDir = mkdtempSync(join(tmpdir(), "gitdocs-sync-"));
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(repoDir, filePath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf8");
  }
  return repoDir;
}

function createGitHubRecorder() {
  const issues = [];
  const comments = [];
  const pullRequests = [];
  const issueLabels = [];
  return {
    issues,
    comments,
    pullRequests,
    issueLabels,
    permissions: new Map(),
    async upsertIssue(issue) {
      issues.push(issue);
      return { number: issues.length, url: `https://example.test/issues/${issues.length}` };
    },
    async getUserPermission(username) {
      return this.permissions.get(username) || "read";
    },
    async replyToIssue(issueNumber, body) {
      comments.push({ issueNumber, body });
    },
    async createPullRequest(pullRequest) {
      pullRequests.push(pullRequest);
      return { number: pullRequests.length, url: `https://example.test/pulls/${pullRequests.length}` };
    },
    async addIssueLabels(issueNumber, labels) {
      issueLabels.push({ issueNumber, labels });
    },
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("first run creates a lightweight sync audit issue for Docusaurus docs", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome to GitDocs Sync.",
    "docs/guide.md": "# Guide\n\nUse the action.",
    "i18n/zh/docusaurus-plugin-content-docs/current/guide.md": "# 指南\n\n使用这个 action。",
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });

  assert.equal(result.status, "audit-created");
  assert.equal(github.issues.length, 1);
  assert.equal(github.issues[0].title, "[GitDocs Sync] Translation sync audit");
  assert.match(github.issues[0].body, /Missing files\s+\|\s+1/);
  assert.match(github.issues[0].body, /Untracked files\s+\|\s+1/);
  assert.match(github.issues[0].body, /Ready for incremental sync\s+\|\s+0/);
  assert.match(github.issues[0].body, /<details>/);
  assert.match(github.issues[0].body, /zh: missing 1, untracked 1, oversized 0, ready 0/);
  assert.match(github.issues[0].body, /\/gitdocs sync zh/);
});

test("first-run audit counts ready docs when Translation Memory covers the source file", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# 介绍\n\n欢迎。",
    ".gitdocs-sync/tm/en-zh.json": JSON.stringify({
      records: [
        { source: "Intro", translation: "介绍", status: "active" },
        { source: "Welcome.", translation: "欢迎。", status: "active" },
      ],
    }),
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });

  assert.equal(result.audit.totals.ready, 1);
  assert.equal(result.audit.totals.untracked, 0);
  assert.match(github.issues[0].body, /Ready for incremental sync\s+\|\s+1/);
});

test("config supports inline arrays through the YAML parser path", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs: [zh]",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "ignore: [docs/internal/**]",
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
    "docs/internal/secret.md": "# Secret\n\nIgnore.",
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });

  assert.equal(result.audit.sourceDocs, 1);
  assert.deepEqual(result.audit.targetLanguages, ["zh"]);
});

test("corrupt Translation Memory does not crash audit or incremental sync", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# 介绍\n\n欢迎。",
    ".gitdocs-sync/tm/en-zh.json": "{broken json",
  });
  const github = createGitHubRecorder();

  const audit = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });
  const incremental = await runGitDocsSync({ repoDir, github, event: { name: "push", changedFiles: [] } });

  assert.equal(audit.status, "audit-created");
  assert.equal(audit.audit.totals.untracked, 1);
  assert.equal(incremental.status, "nothing-to-sync");
});

test("invalid config fails with an actionable message before creating an issue", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome to GitDocs Sync.",
  });
  const github = createGitHubRecorder();

  await assert.rejects(
    () => runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } }),
    /target_langs is required/,
  );
  assert.equal(github.issues.length, 0);
});

test("free plan rejects more than one target language before creating an issue", async () => {
  const previousPlan = process.env.GITDOCS_PLAN;
  process.env.GITDOCS_PLAN = "free";
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "  - ja",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome to GitDocs Sync.",
  });
  const github = createGitHubRecorder();

  try {
    await assert.rejects(
      () => runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } }),
      /Free plan supports 1 target language/,
    );
    assert.equal(github.issues.length, 0);
  } finally {
    restoreEnv("GITDOCS_PLAN", previousPlan);
  }
});

test("free plan rejects more than thirty source docs before translating", async () => {
  const previousPlan = process.env.GITDOCS_PLAN;
  process.env.GITDOCS_PLAN = "free";
  const files = {
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
  };
  for (let index = 1; index <= 31; index += 1) {
    files[`docs/page-${index}.md`] = `# Page ${index}\n\nWelcome.`;
  }
  const repoDir = createRepo(files);
  const github = createGitHubRecorder();
  const translator = {
    async translate() {
      throw new Error("translator should not be called when plan limits fail");
    },
  };

  try {
    await assert.rejects(
      () => runGitDocsSync({ repoDir, github, translator, event: { name: "push", changedFiles: ["docs/page-1.md"] } }),
      /Free plan supports 30 source docs/,
    );
    assert.equal(github.pullRequests.length, 0);
  } finally {
    restoreEnv("GITDOCS_PLAN", previousPlan);
  }
});

test("free plan caps oversized checks even when config requests a higher word limit", async () => {
  const previousPlan = process.env.GITDOCS_PLAN;
  process.env.GITDOCS_PLAN = "free";
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "max_words_per_doc: 50000",
    ].join("\n"),
    "docs/large.md": `# Large\n\n${Array.from({ length: 10001 }, (_, index) => `word${index}`).join(" ")}`,
  });
  const github = createGitHubRecorder();

  try {
    const result = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });
    assert.equal(result.audit.totals.oversized, 1);
    assert.match(github.issues[0].body, /Oversized files\s+\|\s+1/);
  } finally {
    restoreEnv("GITDOCS_PLAN", previousPlan);
  }
});

test("first-run audit marks oversized source docs without translating them", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "max_words_per_doc: 5",
    ].join("\n"),
    "docs/large.md": "# Large\n\none two three four five six",
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });

  assert.equal(result.audit.totals.oversized, 1);
  assert.equal(result.audit.totals.missing, 0);
  assert.match(github.issues[0].body, /Oversized files\s+\|\s+1/);
  assert.match(github.issues[0].body, /split the file/);
  assert.match(github.issues[0].body, /upgrade/);
  assert.match(github.issues[0].body, /skip it/);
});

test("first-run audit counts CJK characters toward oversized document limits", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: zh",
      "target_langs:",
      "  - en",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "max_words_per_doc: 5",
    ].join("\n"),
    "docs/large.md": "# 标题\n\n这是一个超过限制的中文文档",
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });

  assert.equal(result.audit.totals.oversized, 1);
  assert.match(github.issues[0].body, /Oversized files\s+\|\s+1/);
});

test("first-run audit counts Japanese kana and Korean hangul toward oversized document limits", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: ja",
      "target_langs:",
      "  - en",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "max_words_per_doc: 8",
    ].join("\n"),
    "docs/japanese.md": "# はじめに\n\nこれはかなだけでも超過する文書です",
    "docs/korean.md": "# 시작\n\n이문서는공백없이도제한을넘습니다",
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });

  assert.equal(result.audit.totals.oversized, 2);
});

test("issue command from a user without write permission does not trigger sync", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({
    repoDir,
    github,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "external-user" },
    },
  });

  assert.equal(result.status, "permission-denied");
  assert.equal(github.comments.length, 1);
  assert.match(github.comments[0].body, /repo write permission/);
});

test("authorized issue command creates a backfill translation PR for a selected language", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome to GitDocs Sync.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.equal(result.status, "backfill-pr-created");
  assert.deepEqual(github.issueLabels, [{ issueNumber: 7, labels: ["gitdocs-sync-decided"] }]);
  assert.equal(github.pullRequests.length, 1);
  assert.equal(github.pullRequests[0].title, "[GitDocs Sync] Update zh docs (1 files)");
  assert.equal(github.pullRequests[0].branch, "gitdocs-sync/en-to-zh");
  assert.deepEqual(github.pullRequests[0].labels, ["gitdocs-sync", "lang:zh"]);
  assert.equal(
    github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    "# ZH:Intro\n\nZH:Welcome to GitDocs Sync.",
  );
  assert.match(github.pullRequests[0].body, /automatically generated by GitDocs Sync/);
});

test("authorized issue command is ignored after the audit issue has already been decided", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate() {
      throw new Error("decided audit should not translate again");
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit", labels: ["gitdocs-sync-decided"] },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.equal(result.status, "already-decided");
  assert.equal(github.pullRequests.length, 0);
  assert.match(github.comments[0].body, /already been confirmed/);
});

test("backfill preserves front matter, code blocks, inline code, and link URLs", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/advanced.md": [
      "---",
      "id: advanced",
      "slug: /advanced",
      "---",
      "# Advanced setup",
      "",
      "Use `gitdocs sync` after reading [the guide](https://example.com/guide).",
      "",
      "```bash",
      "npm run build",
      "```",
    ].join("\n"),
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  const translated = github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/advanced.md"];
  assert.match(translated, /^---\nid: advanced\nslug: \/advanced\n---/);
  assert.match(translated, /# ZH:Advanced setup/);
  assert.match(translated, /`gitdocs sync`/);
  assert.match(translated, /\[the guide\]\(https:\/\/example.com\/guide\)/);
  assert.match(translated, /```bash\nnpm run build\n```/);
});

test("backfill translates consecutive prose lines as one paragraph to reduce API calls", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nFirst line of one paragraph\ncontinues on the next line.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const calls = [];
  const translator = {
    async translate({ content }) {
      calls.push(content);
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.deepEqual(calls, ["Intro", "First line of one paragraph\ncontinues on the next line."]);
  assert.equal(
    github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    "# ZH:Intro\n\nZH:First line of one paragraph\ncontinues on the next line.",
  );
});

test("backfill preserves tilde and indented code blocks without translating them", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/code.md": [
      "# Code",
      "",
      "~~~bash",
      "echo do-not-translate",
      "~~~",
      "",
      "    npm run build",
      "",
      "Normal prose.",
    ].join("\n"),
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  const translated = github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/code.md"];
  assert.match(translated, /~~~bash\necho do-not-translate\n~~~/);
  assert.match(translated, /\n    npm run build\n/);
  assert.match(translated, /ZH:Normal prose\./);
});

test("backfill preserves Docusaurus MDX imports and JSX blocks without translating them", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/tabs.mdx": [
      "import Tabs from '@theme/Tabs';",
      "import TabItem from '@theme/TabItem';",
      "",
      "# Install",
      "",
      "<Tabs>",
      "<TabItem value=\"npm\" label=\"npm\">",
      "",
      "Use npm.",
      "",
      "</TabItem>",
      "</Tabs>",
    ].join("\n"),
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  const translated = github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/tabs.mdx"];
  assert.match(translated, /^import Tabs from '@theme\/Tabs';/);
  assert.match(translated, /<Tabs>\n<TabItem value="npm" label="npm">/);
  assert.match(translated, /ZH:Use npm\./);
  assert.doesNotMatch(translated, /ZH:<Tabs>|ZH:import/);
});

test("backfill preserves front matter when docs use Windows line endings", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "---\r\nid: intro\r\nslug: /\r\n---\r\n\r\n# Intro\r\n\r\nWelcome.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  const translated = github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"];
  assert.match(translated, /^---\nid: intro\nslug: \/\n---/);
  assert.doesNotMatch(translated, /id: ZH:Intro/);
});

test("push event creates an incremental translation PR for changed docs", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nNew paragraph.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# 介绍\n\n旧段落。",
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "push",
      changedFiles: ["docs/intro.md"],
    },
  });

  assert.equal(result.status, "incremental-pr-created");
  assert.equal(github.pullRequests.length, 1);
  assert.equal(github.pullRequests[0].title, "[GitDocs Sync] Update zh docs (1 files)");
  assert.equal(github.pullRequests[0].branch, "gitdocs-sync/en-to-zh");
  assert.deepEqual(github.pullRequests[0].labels, ["gitdocs-sync", "lang:zh"]);
  assert.equal(
    github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    "# ZH:Intro\n\nZH:New paragraph.",
  );
  assert.match(github.pullRequests[0].body, /Only changed source docs are included/);
  assert.doesNotMatch(github.pullRequests[0].body, /missing files|backfill/i);
});

test("push dry run plans incremental PRs without creating PRs or calling translators", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "dry_run: true",
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nNew paragraph.",
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate() {
      throw new Error("translator should not be called during incremental dry run");
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: { name: "push", changedFiles: ["docs/intro.md"] },
  });

  assert.equal(result.status, "dry-run-planned");
  assert.equal(github.pullRequests.length, 0);
  assert.deepEqual(result.plan, [
    {
      targetLang: "zh",
      batchNumber: 1,
      totalBatches: 1,
      files: ["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    },
  ]);
});

test("incremental sync preserves existing target translations for unchanged TM-matched segments", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nKnown paragraph.\n\nChanged paragraph.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# 人工润色标题\n\n人工润色旧段落。\n\n旧的第三段。",
    ".gitdocs-sync/tm/en-zh.json": JSON.stringify({
      records: [
        { source: "Intro", translation: "机器标题", status: "active" },
        { source: "Known paragraph.", translation: "机器旧段落。", status: "active" },
      ],
    }),
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: { name: "push", changedFiles: ["docs/intro.md"] },
  });

  assert.equal(
    github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    "# 人工润色标题\n\n人工润色旧段落。\n\nZH:Changed paragraph.",
  );
});

test("incremental sync marks target files for deletion when source docs are removed", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "i18n/zh/docusaurus-plugin-content-docs/current/old.md": "# 旧页面\n\n应该删除。",
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate() {
      throw new Error("deleted source docs should not be translated");
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: { name: "push", changedFiles: ["docs/old.md"] },
  });

  assert.equal(result.status, "incremental-pr-created");
  assert.deepEqual(github.pullRequests[0].files, {
    "i18n/zh/docusaurus-plugin-content-docs/current/old.md": null,
  });
});

test("incremental sync splits changed docs into batches of thirty files", async () => {
  const files = {
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
  };
  const changedFiles = [];
  for (let index = 1; index <= 31; index += 1) {
    const fileName = `page-${String(index).padStart(2, "0")}.md`;
    files[`docs/${fileName}`] = `# Page ${index}\n\nUpdated ${index}.`;
    changedFiles.push(`docs/${fileName}`);
  }
  const repoDir = createRepo(files);
  const github = createGitHubRecorder();
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  const result = await runGitDocsSync({ repoDir, github, translator, event: { name: "push", changedFiles } });

  assert.equal(result.status, "incremental-pr-created");
  assert.equal(github.pullRequests.length, 2);
  assert.equal(Object.keys(github.pullRequests[0].files).length, 30);
  assert.equal(Object.keys(github.pullRequests[1].files).length, 1);
  assert.match(github.pullRequests[0].body, /Batch 1 of 2/);
  assert.match(github.pullRequests[1].body, /Batch 2 of 2/);
});

test("backfill translates docs with a small concurrency limit", async () => {
  const files = {
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
  };
  for (let index = 1; index <= 6; index += 1) {
    files[`docs/page-${index}.md`] = `# Page ${index}\n\nHello ${index}.`;
  }
  const repoDir = createRepo(files);
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  let active = 0;
  let maxActive = 0;
  const translator = {
    async translate({ content }) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.equal(github.pullRequests.length, 1);
  assert.equal(maxActive, 3);
});

test("inline placeholder protection does not replace customer text that looks like a token", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "Literal __GITDOCS_0__ and `code` stay distinct.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  const translated = github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"];
  assert.match(translated, /__GITDOCS_0__/);
  assert.match(translated, /`code`/);
}
);

test("push event falls back to Translation Memory drift when changed files are unavailable", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nKnown paragraph.\n\nNew paragraph.",
    "docs/guide.md": "# Guide\n\nKnown guide.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# Intro zh\n\nKnown paragraph zh.",
    "i18n/zh/docusaurus-plugin-content-docs/current/guide.md": "# Guide zh\n\nKnown guide zh.",
    ".gitdocs-sync/tm/en-zh.json": JSON.stringify({
      records: [
        { source: "Intro", translation: "Intro zh", status: "active" },
        { source: "Known paragraph.", translation: "Known paragraph zh.", status: "active" },
        { source: "Guide", translation: "Guide zh", status: "active" },
        { source: "Known guide.", translation: "Known guide zh.", status: "active" },
      ],
    }),
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "push",
      changedFiles: [],
    },
  });

  assert.equal(result.status, "incremental-pr-created");
  assert.deepEqual(Object.keys(github.pullRequests[0].files), ["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"]);
  assert.equal(
    github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    "# Intro zh\n\nKnown paragraph zh.\n\nZH:New paragraph.",
  );
});

test("placeholder restore preserves dollar replacement patterns in protected content", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "Read [the guide](https://example.com/$&/$1) and run `$ npm test`.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  const translated = github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"];
  assert.match(translated, /https:\/\/example\.com\/\$&\/\$1/);
  assert.match(translated, /`\$ npm test`/);
});

test("links are translated with one provider call for the containing segment", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "Read [the guide](https://example.com/guide).",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const calls = [];
  const translator = {
    async translate({ content }) {
      calls.push(content);
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0], /\[the guide\]\(__GITDOCS_/);
});

test("incremental sync keeps existing target text when one changed segment fails but most segments succeed", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nKnown paragraph.\n\nChanged paragraph.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# 旧标题\n\n旧已知段落。\n\n人工旧第三段。",
    ".gitdocs-sync/tm/en-zh.json": JSON.stringify({
      records: [
        { source: "Intro", translation: "机器标题", status: "active" },
        { source: "Known paragraph.", translation: "机器旧段落。", status: "active" },
      ],
    }),
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate() {
      throw new Error("provider timeout on one segment");
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: { name: "push", changedFiles: ["docs/intro.md"] },
  });

  assert.equal(
    github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    "# 旧标题\n\n旧已知段落。\n\n人工旧第三段。",
  );
  assert.match(github.pullRequests[0].body, /Failed segments:\*\* 1/);
});

test("lists and table rows are translated as separate structural units", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/structured.md": [
      "# Structured",
      "",
      "- First item",
      "- Second item",
      "",
      "| Name | Description |",
      "|---|---|",
      "| API | Public endpoint |",
    ].join("\n"),
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const calls = [];
  const translator = {
    async translate({ content }) {
      calls.push(content);
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.deepEqual(calls, ["Structured", "First item", "Second item", "Name", "Description", "API", "Public endpoint"]);
  const translated = github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/structured.md"];
  assert.match(translated, /- ZH:First item\n- ZH:Second item/);
  assert.match(translated, /\| ZH:API \| ZH:Public endpoint \|/);
});

test("merged translation PR skips TM writes when source and target segments do not align", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nOne source paragraph.\n\nSecond source paragraph.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# 介绍\n\n译文第一段。\n\n译者新增的一段解释。\n\n译文第二段。",
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({
    repoDir,
    github,
    event: {
      name: "pull_request.closed",
      pullRequest: {
        merged: true,
        number: 12,
        url: "https://example.test/pulls/12",
        labels: ["gitdocs-sync", "lang:zh"],
      },
    },
  });

  const tmPath = join(repoDir, ".gitdocs-sync", "tm", "en-zh.json");
  assert.equal(result.status, "tm-updated");
  const tm = JSON.parse(readFileSync(tmPath, "utf8"));
  assert.equal(tm.records.length, 0);
});

test("merged translation PR writes active Translation Memory in the repo", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome to GitDocs Sync.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# 介绍\n\n欢迎使用 GitDocs Sync。",
  });
  const github = createGitHubRecorder();

  const result = await runGitDocsSync({
    repoDir,
    github,
    event: {
      name: "pull_request.closed",
      pullRequest: {
        merged: true,
        number: 12,
        url: "https://example.test/pulls/12",
        labels: ["gitdocs-sync", "lang:zh"],
      },
    },
  });

  const tmPath = join(repoDir, ".gitdocs-sync", "tm", "en-zh.json");
  assert.equal(result.status, "tm-updated");
  assert.equal(existsSync(tmPath), true);
  const tm = JSON.parse(readFileSync(tmPath, "utf8"));
  assert.equal(tm.records.length, 2);
  assert.equal(tm.records[0].status, "active");
  assert.equal(tm.records[0].pr_url, "https://example.test/pulls/12");
});

test("merged translation PR opens a Translation Memory PR instead of writing directly to the base branch", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome to GitDocs Sync.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# Intro zh\n\nWelcome zh.",
  });
  const commits = [];
  const pullRequests = [];
  const github = {
    async commitFiles(commit) {
      commits.push(commit);
      return { url: "https://example.test/commit/tm" };
    },
    async createPullRequest(pullRequest) {
      pullRequests.push(pullRequest);
      return { number: 20, url: "https://example.test/pulls/20" };
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    event: {
      name: "pull_request.closed",
      pullRequest: {
        merged: true,
        number: 12,
        url: "https://example.test/pulls/12",
        labels: ["gitdocs-sync", "lang:zh"],
      },
    },
  });

  assert.equal(result.status, "tm-updated");
  assert.equal(commits.length, 0);
  assert.equal(pullRequests.length, 1);
  assert.equal(pullRequests[0].branch, "gitdocs-sync/tm-en-to-zh-pr-12");
  assert.deepEqual(pullRequests[0].labels, ["gitdocs-sync-tm"]);
  assert.ok(pullRequests[0].files[".gitdocs-sync/tm/en-zh.json"]);
});

test("merged translation PR opens a Translation Memory PR when direct commit is blocked", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
    "i18n/zh/docusaurus-plugin-content-docs/current/intro.md": "# Intro zh\n\nWelcome zh.",
  });
  const pullRequests = [];
  const github = {
    async commitFiles() {
      throw new Error("Branch protection blocked direct commits");
    },
    async createPullRequest(pullRequest) {
      pullRequests.push(pullRequest);
      return { number: 20, url: "https://example.test/pulls/20" };
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    event: {
      name: "pull_request.closed",
      pullRequest: {
        merged: true,
        number: 12,
        url: "https://example.test/pulls/12",
        labels: ["gitdocs-sync", "lang:zh"],
      },
    },
  });

  assert.equal(result.status, "tm-updated");
  assert.equal(pullRequests.length, 1);
  assert.equal(pullRequests[0].branch, "gitdocs-sync/tm-en-to-zh-pr-12");
  assert.deepEqual(pullRequests[0].labels, ["gitdocs-sync-tm"]);
  assert.ok(pullRequests[0].files[".gitdocs-sync/tm/en-zh.json"]);
});

test("backfill splits selected language PRs into batches of thirty files", async () => {
  const files = {
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
  };
  for (let index = 1; index <= 31; index += 1) {
    files[`docs/page-${String(index).padStart(2, "0")}.md`] = `# Page ${index}\n\nHello ${index}.`;
  }
  const repoDir = createRepo(files);
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.equal(result.status, "backfill-pr-created");
  assert.equal(github.pullRequests.length, 2);
  assert.equal(Object.keys(github.pullRequests[0].files).length, 30);
  assert.equal(Object.keys(github.pullRequests[1].files).length, 1);
  assert.match(github.pullRequests[0].body, /Batch 1 of 2/);
  assert.match(github.pullRequests[1].body, /Batch 2 of 2/);
});

test("incremental sync reuses exact Translation Memory matches without calling translator", async () => {
  const source = "# Intro\n\nWelcome to GitDocs Sync.";
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": source,
    ".gitdocs-sync/tm/en-zh.json": JSON.stringify({
      records: [
        { source: "Intro", translation: "介绍", status: "active" },
        { source: "Welcome to GitDocs Sync.", translation: "欢迎使用 GitDocs Sync。", status: "active" },
      ],
    }),
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate() {
      throw new Error("translator should not be called for exact TM matches");
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "push",
      changedFiles: ["docs/intro.md"],
    },
  });

  assert.equal(result.status, "incremental-pr-created");
  assert.equal(
    github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    "# 介绍\n\n欢迎使用 GitDocs Sync。",
  );
  assert.match(github.pullRequests[0].body, /Translation Memory matches:\*\* 2/);
  assert.match(github.pullRequests[0].body, /New translations:\*\* 0/);
});

test("incremental sync can reuse Translation Memory records by source hash", async () => {
  const source = "# Intro\n\nWelcome to GitDocs Sync.";
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": source,
    ".gitdocs-sync/tm/en-zh.json": JSON.stringify({
      records: [
        { source_hash: "24601bcaae6e170b381367ec4f4475786c6dbef5e8332f8903779c76d298d304", translation: "介绍", status: "active" },
        { source_hash: "e80dc280412240e509efe0009b226434cd98be84f6addcd21bad30ecb6f263d8", translation: "欢迎使用 GitDocs Sync。", status: "active" },
      ],
    }),
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate() {
      throw new Error("translator should not be called for hash TM matches");
    },
  };

  await runGitDocsSync({ repoDir, github, translator, event: { name: "push", changedFiles: ["docs/intro.md"] } });

  assert.equal(
    github.pullRequests[0].files["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    "# 介绍\n\n欢迎使用 GitDocs Sync。",
  );
});

test("translation PR body reports skipped oversized files", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "max_words_per_doc: 5",
    ].join("\n"),
    "docs/small.md": "# Small\n\nok",
    "docs/large.md": "# Large\n\none two three four five six",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.equal(Object.keys(github.pullRequests[0].files).length, 1);
  assert.match(github.pullRequests[0].body, /Skipped oversized files:\*\* 1/);
  assert.match(github.pullRequests[0].body, /docs\/large.md/);
  assert.match(github.pullRequests[0].body, /split the file/);
  assert.match(github.pullRequests[0].body, /upgrade/);
  assert.match(github.pullRequests[0].body, /skip it/);
});

test("authorized issue command can sync multiple selected languages", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "  - ja",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ targetLang, content }) {
      return `${targetLang.toUpperCase()}:${content}`;
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh,ja", user: "maintainer" },
    },
  });

  assert.equal(result.status, "backfill-pr-created");
  assert.equal(github.pullRequests.length, 2);
  assert.equal(github.pullRequests[0].title, "[GitDocs Sync] Update zh docs (1 files)");
  assert.equal(github.pullRequests[1].title, "[GitDocs Sync] Update ja docs (1 files)");
});

test("authorized issue command sync all uses configured target languages", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "  - ja",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ targetLang, content }) {
      return `${targetLang.toUpperCase()}:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 7, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync all", user: "maintainer" },
    },
  });

  assert.deepEqual(
    github.pullRequests.map((pullRequest) => pullRequest.title),
    ["[GitDocs Sync] Update zh docs (1 files)", "[GitDocs Sync] Update ja docs (1 files)"],
  );
});

test("ignored docs are excluded from audit and backfill", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "ignore:",
      "  - docs/changelog.md",
      "  - docs/internal/**",
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
    "docs/changelog.md": "# Changelog\n\nDo not sync.",
    "docs/internal/secret.md": "# Secret\n\nDo not sync.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  const audit = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });
  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 1, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.equal(audit.audit.sourceDocs, 1);
  assert.deepEqual(Object.keys(github.pullRequests[0].files), ["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"]);
});

test("ignore patterns support common glob wildcards", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "ignore:",
      "  - docs/**/*.draft.md",
      "  - docs/private/*.md",
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
    "docs/guides/setup.draft.md": "# Draft\n\nIgnore nested draft.",
    "docs/private/key.md": "# Private\n\nIgnore direct private file.",
  });
  const github = createGitHubRecorder();

  const audit = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });

  assert.equal(audit.audit.sourceDocs, 1);
});

test("config normalizes docs_dir and output_dir when trailing slashes are omitted", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
  });
  const github = createGitHubRecorder();
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: { name: "push", changedFiles: ["docs/intro.md"] },
  });

  assert.deepEqual(Object.keys(github.pullRequests[0].files), ["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"]);
});

test("dry run reports planned backfill PRs without creating PRs or translating", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
      "dry_run: true",
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate() {
      throw new Error("translator should not be called during dry run");
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 1, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  assert.equal(result.status, "dry-run-planned");
  assert.equal(github.pullRequests.length, 0);
  assert.deepEqual(result.plan, [
    {
      targetLang: "zh",
      batchNumber: 1,
      totalBatches: 1,
      files: ["i18n/zh/docusaurus-plugin-content-docs/current/intro.md"],
    },
  ]);
});

test("authorized future-only command confirms incremental sync without backfill", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate() {
      throw new Error("future-only should not translate backfill docs");
    },
  };

  const result = await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 1, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs future-only", user: "maintainer" },
    },
  });

  assert.equal(result.status, "future-only-confirmed");
  assert.equal(github.pullRequests.length, 0);
  assert.deepEqual(github.issueLabels, [{ issueNumber: 1, labels: ["gitdocs-sync-decided", "gitdocs-sync-future-only"] }]);
  assert.equal(github.comments.length, 1);
  assert.match(github.comments[0].body, /future doc changes/);
});

test("backfill records privacy-safe usage metadata after creating PRs", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translate({ content }) {
      return `ZH:${content}`;
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 1, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  const usage = readFileSync(join(repoDir, ".gitdocs-sync", "usage.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(usage.length, 1);
  assert.equal(usage[0].event, "backfill");
  assert.equal(usage[0].targetLang, "zh");
  assert.equal(usage[0].filesChanged, 1);
  assert.equal(usage[0].newTranslations, 2);
  assert.equal("source" in usage[0], false);
});

test("backfill records provider token usage without storing document bodies", async () => {
  const repoDir = createRepo({
    ".gitdocs-sync.yml": [
      "source_lang: en",
      "target_langs:",
      "  - zh",
      "docs_dir: docs/",
      'output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"',
    ].join("\n"),
    "docs/intro.md": "# Intro\n\nWelcome.",
  });
  const github = createGitHubRecorder();
  github.permissions.set("maintainer", "write");
  const translator = {
    async translateWithUsage({ content }) {
      return {
        text: `ZH:${content}`,
        usage: {
          provider: "deepseek",
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
      };
    },
  };

  await runGitDocsSync({
    repoDir,
    github,
    translator,
    event: {
      name: "issue_comment",
      issue: { number: 1, title: "[GitDocs Sync] Translation sync audit" },
      comment: { body: "/gitdocs sync zh", user: "maintainer" },
    },
  });

  const [usage] = readFileSync(join(repoDir, ".gitdocs-sync", "usage.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(usage.provider, "deepseek");
  assert.equal(usage.inputTokens, 20);
  assert.equal(usage.outputTokens, 10);
  assert.equal(usage.totalTokens, 30);
  assert.match(github.pullRequests[0].body, /Provider:\*\* deepseek/);
  assert.match(github.pullRequests[0].body, /Total tokens:\*\* 30/);
  assert.equal("source" in usage, false);
  assert.equal("translation" in usage, false);
});

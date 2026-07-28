const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");

const { runGitDocsSync } = require("../src/gitdocs-sync");

test("Docusaurus demo fixture produces the expected sync audit", async () => {
  const issues = [];
  const repoDir = join(__dirname, "..", "examples", "docusaurus-demo");
  const github = {
    async upsertIssue(issue) {
      issues.push(issue);
      return { number: 1, url: "https://example.test/issues/1" };
    },
  };

  const result = await runGitDocsSync({ repoDir, github, event: { name: "workflow_dispatch" } });

  assert.equal(result.status, "audit-created");
  assert.equal(result.audit.sourceDocs, 2);
  assert.equal(result.audit.byLanguage.zh.missing, 1);
  assert.equal(result.audit.byLanguage.zh.untracked, 1);
  assert.equal(result.audit.targetLanguages.length, 1);
  assert.match(issues[0].body, /\/gitdocs sync zh/);
});

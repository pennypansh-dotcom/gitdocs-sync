const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const script = join(root, "scripts", "validate-launch-inputs.js");

test("launch input validator accepts the expected launch values", () => {
  const output = execFileSync(
    process.execPath,
    [
      script,
      "--url",
      "https://docsync.example",
      "--pro-url",
      "https://buy.stripe.com/pro_test",
      "--team-url",
      "https://buy.stripe.com/team_test",
      "--repo",
      "pennypansh-dotcom/gitdocs-sync",
      "--smoke-repo",
      "pennypansh-dotcom/gitdocs-sync-docusaurus-smoke",
    ],
    { cwd: root, encoding: "utf8" },
  );

  assert.match(output, /Launch inputs validated/);
  assert.match(output, /docsync\.example/);
  assert.match(output, /pennypansh-dotcom\/gitdocs-sync/);
});

test("launch input validator rejects malformed repo slugs", () => {
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          script,
          "--url",
          "https://docsync.example",
          "--pro-url",
          "https://buy.stripe.com/pro_test",
          "--team-url",
          "https://buy.stripe.com/team_test",
          "--repo",
          "gitdocs-sync",
        ],
        { cwd: root, encoding: "utf8" },
      ),
    /owner\/repo/,
  );
});

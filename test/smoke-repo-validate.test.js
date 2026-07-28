const assert = require("node:assert/strict");
const { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");

const root = join(__dirname, "..");
const script = join(root, "scripts", "validate-smoke-repo.js");

test("smoke repo validator accepts a repo configured for the published Action", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "gitdocs-smoke-"));
  mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
  cpSync(join(root, "examples", "docusaurus-demo", ".gitdocs-sync.yml"), join(repoDir, ".gitdocs-sync.yml"));
  const configPath = join(repoDir, ".gitdocs-sync.yml");
  writeFileSync(configPath, readFileSync(configPath, "utf8").replace("dry_run: true", "dry_run: false"), "utf8");
  writeFileSync(
    join(repoDir, ".github", "workflows", "gitdocs-sync.yml"),
    [
      "name: GitDocs Sync",
      "on: [workflow_dispatch]",
      "jobs:",
      "  sync:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: pennypansh-dotcom/gitdocs-sync@v0.1.0",
      "        with:",
      "          github_token: ${{ secrets.GITHUB_TOKEN }}",
      '          dry_run: "false"',
      "        env:",
      "          GITDOCS_LICENSE_KEY: ${{ secrets.GITDOCS_LICENSE_KEY }}",
      "          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}",
    ].join("\n"),
    "utf8",
  );

  const output = execFileSync(process.execPath, [script, "--repo-dir", repoDir], {
    cwd: root,
    encoding: "utf8",
  });

  assert.match(output, /Smoke repo validated/);
  assert.match(output, /pennypansh-dotcom\/gitdocs-sync@v0.1.0/);
  assert.match(output, /dry_run: false/);
});

test("smoke repo validator rejects local workflow references", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "gitdocs-smoke-"));
  mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
  writeFileSync(
    join(repoDir, ".gitdocs-sync.yml"),
    ["source_lang: en", "target_langs:", "  - zh", "docs_dir: docs/", "dry_run: false"].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(repoDir, ".github", "workflows", "gitdocs-sync.yml"),
    [
      "name: GitDocs Sync",
      "on: [workflow_dispatch]",
      "jobs:",
      "  sync:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: ./",
    ].join("\n"),
    "utf8",
  );

  assert.throws(
    () => execFileSync(process.execPath, [script, "--repo-dir", repoDir], { cwd: root, encoding: "utf8" }),
    /published Action/,
  );
});

test("smoke repo validator rejects workflows without the required license key", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "gitdocs-smoke-"));
  mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
  writeFileSync(
    join(repoDir, ".gitdocs-sync.yml"),
    ["source_lang: en", "target_langs: [zh]", "docs_dir: docs/", "dry_run: false"].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(repoDir, ".github", "workflows", "gitdocs-sync.yml"),
    [
      "name: GitDocs Sync",
      "on: [workflow_dispatch]",
      "jobs:",
      "  sync:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: pennypansh-dotcom/gitdocs-sync@v0.1.0",
      "        with:",
      "          github_token: ${{ secrets.GITHUB_TOKEN }}",
      '          dry_run: "false"',
      "        env:",
      "          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}",
    ].join("\n"),
    "utf8",
  );

  assert.throws(
    () => execFileSync(process.execPath, [script, "--repo-dir", repoDir], { cwd: root, encoding: "utf8" }),
    /GITDOCS_LICENSE_KEY/,
  );
});

test("smoke repo validator rejects workflow dry-run mode for live smoke", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "gitdocs-smoke-"));
  mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
  writeFileSync(
    join(repoDir, ".gitdocs-sync.yml"),
    ["source_lang: en", "target_langs: [zh]", "docs_dir: docs/", "dry_run: false"].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(repoDir, ".github", "workflows", "gitdocs-sync.yml"),
    [
      "name: GitDocs Sync",
      "on: [workflow_dispatch]",
      "jobs:",
      "  sync:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: pennypansh-dotcom/gitdocs-sync@v0.1.0",
      "        with:",
      "          github_token: ${{ secrets.GITHUB_TOKEN }}",
      '          dry_run: "true"',
      "        env:",
      "          GITDOCS_LICENSE_KEY: ${{ secrets.GITDOCS_LICENSE_KEY }}",
      "          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}",
    ].join("\n"),
    "utf8",
  );

  assert.throws(
    () => execFileSync(process.execPath, [script, "--repo-dir", repoDir], { cwd: root, encoding: "utf8" }),
    /dry_run: "false"/,
  );
});

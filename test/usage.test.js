const assert = require("node:assert/strict");
const { existsSync, mkdtempSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");

const { recordUsage } = require("../src/usage");

test("recordUsage appends privacy-safe metadata as json lines", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "gitdocs-usage-"));

  recordUsage(repoDir, {
    event: "backfill",
    targetLang: "zh",
    filesChanged: 2,
    tmMatches: 3,
    newTranslations: 4,
    skippedOversized: 1,
    provider: "deepseek",
    inputTokens: 120,
    outputTokens: 45,
    totalTokens: 165,
  });

  const usagePath = join(repoDir, ".gitdocs-sync", "usage.jsonl");
  assert.equal(existsSync(usagePath), true);
  const [line] = readFileSync(usagePath, "utf8").trim().split("\n");
  const entry = JSON.parse(line);
  assert.equal(entry.event, "backfill");
  assert.equal(entry.targetLang, "zh");
  assert.equal(entry.totalTokens, 165);
  assert.equal("source" in entry, false);
  assert.equal("translation" in entry, false);
});

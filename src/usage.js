const { appendFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

function recordUsage(repoDir, usage) {
  const usageDir = join(repoDir, ".gitdocs-sync");
  mkdirSync(usageDir, { recursive: true });
  const safeUsage = {
    recordedAt: new Date().toISOString(),
    event: usage.event,
    targetLang: usage.targetLang,
    filesChanged: usage.filesChanged || 0,
    tmMatches: usage.tmMatches || 0,
    newTranslations: usage.newTranslations || 0,
    skippedOversized: usage.skippedOversized || 0,
    provider: usage.provider,
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    totalTokens: usage.totalTokens || 0,
  };
  appendFileSync(join(usageDir, "usage.jsonl"), `${JSON.stringify(safeUsage)}\n`, "utf8");
}

module.exports = { recordUsage };

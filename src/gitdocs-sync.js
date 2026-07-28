const { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { recordUsage } = require("./usage");
const { join, relative } = require("node:path");

async function runGitDocsSync({ repoDir, github, translator, event = { name: "workflow_dispatch" } }) {
  if (event.name === "issue_comment") {
    return handleIssueComment({ repoDir, github, translator, event });
  }
  if (event.name === "push") {
    return createIncrementalPullRequests({ repoDir, github, translator, event });
  }
  if (event.name === "pull_request.closed") {
    return updateTranslationMemoryAfterMerge({ repoDir, github, event });
  }
  const config = readConfig(repoDir);
  validateConfig(config);
  enforcePlanLimits(repoDir, config);
  const audit = createAudit(repoDir, config);
  const issue = {
    title: "[GitDocs Sync] Translation sync audit",
    body: renderAuditIssue(audit, config),
  };
  const created = await github.upsertIssue(issue);
  return { status: "audit-created", issue: created, audit };
}

async function updateTranslationMemoryAfterMerge({ repoDir, github, event }) {
  const pullRequest = event.pullRequest || {};
  if (!pullRequest.merged || !pullRequest.labels?.includes("gitdocs-sync")) {
    return { status: "ignored" };
  }
  const langLabel = pullRequest.labels.find((label) => label.startsWith("lang:"));
  if (!langLabel) {
    return { status: "ignored" };
  }
  const targetLang = langLabel.slice("lang:".length);
  const config = readConfig(repoDir);
  validateConfig(config);
  enforcePlanLimits(repoDir, config);

  const sourceRoot = join(repoDir, config.docs_dir);
  const targetRoot = join(repoDir, config.output_dir.replace("{locale}", targetLang));
  const sourceDocs = listMarkdownFiles(sourceRoot);
  const records = [];
  for (const sourceDoc of sourceDocs) {
    const targetPath = join(targetRoot, sourceDoc);
    if (!existsSync(targetPath)) continue;
    const sourceSegments = extractTranslatableSegments(readFileSync(join(sourceRoot, sourceDoc), "utf8"));
    const targetSegments = extractTranslatableSegments(readFileSync(targetPath, "utf8"));
    if (sourceSegments.length !== targetSegments.length) {
      console.warn(`GitDocs Sync skipped Translation Memory for ${sourceDoc}: source and target segment counts do not match.`);
      continue;
    }
    for (let index = 0; index < sourceSegments.length; index += 1) {
      records.push({
        source_hash: hashText(sourceSegments[index]),
        source: sourceSegments[index],
        translation: targetSegments[index],
        status: "active",
        pr_url: pullRequest.url,
      });
    }
  }

  const tmDir = join(repoDir, ".gitdocs-sync", "tm");
  mkdirSync(tmDir, { recursive: true });
  const tmRelativePath = `.gitdocs-sync/tm/${config.source_lang}-${targetLang}.json`;
  const tmContent = `${JSON.stringify({ records }, null, 2)}\n`;
  writeFileSync(join(repoDir, tmRelativePath), tmContent, "utf8");
  if (typeof github?.createPullRequest === "function") {
    await github.createPullRequest({
      branch: `gitdocs-sync/tm-${config.source_lang}-to-${targetLang}-pr-${pullRequest.number || "merged"}`,
      title: `[GitDocs Sync] Update ${targetLang} Translation Memory`,
      body: [
        "## GitDocs Sync Translation Memory",
        "",
        "GitDocs Sync stores this memory through a PR so reviewers can see exactly what will be reused in future sync runs.",
        "Merge this PR to let future sync runs reuse exact translation matches.",
      ].join("\n"),
      labels: ["gitdocs-sync-tm"],
      files: { [tmRelativePath]: tmContent },
    });
  }
  return { status: "tm-updated", records: records.length };
}

async function createIncrementalPullRequests({ repoDir, github, translator, event }) {
  const config = readConfig(repoDir);
  validateConfig(config);
  enforcePlanLimits(repoDir, config);
  const changedDocs = resolveIncrementalDocs(repoDir, config, event);
  if (config.dry_run) {
    return { status: "dry-run-planned", plan: buildIncrementalPlan(config, changedDocs) };
  }

  let created = 0;
  for (const targetLang of config.target_langs) {
    const stats = createStats();
    const translationMemory = readTranslationMemory(repoDir, config, targetLang);
    const translatedEntries = await mapWithConcurrency(changedDocs, 3, async (sourceDoc) => {
      const sourcePath = join(repoDir, config.docs_dir, sourceDoc);
      const targetPath = `${config.output_dir.replace("{locale}", targetLang)}${sourceDoc}`;
      if (!existsSync(sourcePath)) {
        return existsSync(join(repoDir, targetPath)) ? [targetPath, null] : undefined;
      }
      const content = readFileSync(sourcePath, "utf8");
      const existingTargetPath = join(repoDir, targetPath);
      const existingTargetContent = existsSync(existingTargetPath) ? readFileSync(existingTargetPath, "utf8") : undefined;
      const translated = await translateMarkdownDocument({
        translator,
        sourceLang: config.source_lang,
        targetLang,
        content,
        filePath: sourceDoc,
        translationMemory,
        existingTargetContent,
        stats,
      });
      return [targetPath, translated];
    });
    const files = Object.fromEntries(translatedEntries.filter(Boolean));
    if (Object.keys(files).length > 0) {
      const batches = chunkEntries(Object.entries(files), 30);
      for (let index = 0; index < batches.length; index += 1) {
        const batchFiles = Object.fromEntries(batches[index]);
        await github.createPullRequest({
          branch: translationBranch(config.source_lang, targetLang),
          title: `[GitDocs Sync] Update ${targetLang} docs (${Object.keys(batchFiles).length} files)`,
          body: renderTranslationPullRequest({
            targetLang,
            files: batchFiles,
            stats,
            mode: "incremental",
            batchNumber: index + 1,
            totalBatches: batches.length,
          }),
          labels: translationLabels(targetLang),
          files: batchFiles,
        });
        recordUsage(repoDir, {
          event: "incremental",
          targetLang,
          filesChanged: Object.keys(batchFiles).length,
          tmMatches: stats.tmMatches,
          newTranslations: stats.newTranslations,
          skippedOversized: stats.skippedOversized.length,
          ...stats.providerUsage,
        });
        created += 1;
      }
    }
  }

  return { status: created > 0 ? "incremental-pr-created" : "nothing-to-sync" };
}

function buildIncrementalPlan(config, changedDocs) {
  const plans = [];
  for (const targetLang of config.target_langs) {
    const targetRoot = config.output_dir.replace("{locale}", targetLang);
    const filePaths = changedDocs.map((sourceDoc) => `${targetRoot}${sourceDoc}`);
    plans.push(...buildBackfillPlan(targetLang, filePaths));
  }
  return plans;
}

function resolveIncrementalDocs(repoDir, config, event) {
  const changedDocs = (event.changedFiles || [])
    .filter((filePath) => filePath.startsWith(config.docs_dir))
    .filter((filePath) => !isIgnored(filePath, config.ignore))
    .filter((filePath) => filePath.endsWith(".md") || filePath.endsWith(".mdx"))
    .map((filePath) => filePath.slice(config.docs_dir.length));
  if (changedDocs.length > 0) {
    return [...new Set(changedDocs)];
  }
  return docsWithMissingTranslationMemorySegments(repoDir, config);
}

function docsWithMissingTranslationMemorySegments(repoDir, config) {
  const sourceRoot = join(repoDir, config.docs_dir);
  const sourceDocs = listMarkdownFiles(sourceRoot).filter((sourceDoc) => !isIgnored(`${config.docs_dir}${sourceDoc}`, config.ignore));
  const staleDocs = new Set();
  for (const targetLang of config.target_langs) {
    const translationMemory = readTranslationMemory(repoDir, config, targetLang);
    if (translationMemory.size === 0) continue;
    const targetRoot = join(repoDir, config.output_dir.replace("{locale}", targetLang));
    for (const sourceDoc of sourceDocs) {
      if (!existsSync(join(targetRoot, sourceDoc))) continue;
      const segments = extractTranslatableSegments(readFileSync(join(sourceRoot, sourceDoc), "utf8"));
      if (segments.some((segment) => !translationMemory.has(segment))) {
        staleDocs.add(sourceDoc);
      }
    }
  }
  return [...staleDocs].sort();
}

async function handleIssueComment({ repoDir, github, translator, event }) {
  if (event.issue?.title !== "[GitDocs Sync] Translation sync audit") {
    return { status: "ignored" };
  }
  const body = event.comment?.body?.trim() || "";
  if (!body.startsWith("/gitdocs")) {
    return { status: "ignored" };
  }
  if ((event.issue?.labels || []).includes("gitdocs-sync-decided")) {
    await github.replyToIssue(
      event.issue.number,
      "GitDocs Sync has already been confirmed for this audit Issue. Open a new audit if you want to change the first-run decision.",
    );
    return { status: "already-decided" };
  }
  const permission = await github.getUserPermission(event.comment.user);
  if (!["write", "admin"].includes(permission)) {
    await github.replyToIssue(
      event.issue.number,
      "GitDocs Sync needs a repo member with repo write permission to confirm this command.",
    );
    return { status: "permission-denied" };
  }
  if (body === "/gitdocs future-only") {
    await markAuditDecided(github, event.issue.number, ["gitdocs-sync-future-only"]);
    await github.replyToIssue(
      event.issue.number,
      "GitDocs Sync will skip the first-run backfill. future doc changes will still create translation PRs.",
    );
    return { status: "future-only-confirmed" };
  }
  const match = body.match(/^\/gitdocs\s+sync\s+([a-zA-Z,-]+|all)$/);
  if (!match) {
    await github.replyToIssue(
      event.issue.number,
      "Supported commands: /gitdocs sync all, /gitdocs sync zh, /gitdocs sync zh,ja, /gitdocs future-only",
    );
    return { status: "invalid-command" };
  }
  const config = readConfig(repoDir);
  validateConfig(config);
  enforcePlanLimits(repoDir, config);
  await markAuditDecided(github, event.issue.number);
  const targetLanguages = match[1] === "all" ? config.target_langs : match[1].split(",").map((lang) => lang.trim()).filter(Boolean);
  let created = 0;
  const pullRequests = [];
  const plan = [];
  for (const targetLang of targetLanguages) {
    if (!config.target_langs.includes(targetLang)) continue;
    const result = await createBackfillPullRequest({ repoDir, github, translator, targetLang, config });
    if (result.status === "dry-run-planned") {
      plan.push(...result.plan);
      continue;
    }
    if (result.status === "backfill-pr-created") {
      created += result.pullRequests.length;
      pullRequests.push(...result.pullRequests);
    }
  }
  if (plan.length > 0 && created === 0) {
    return { status: "dry-run-planned", plan };
  }
  return created > 0 ? { status: "backfill-pr-created", pullRequests } : { status: "nothing-to-sync" };
}

async function markAuditDecided(github, issueNumber, extraLabels = []) {
  if (typeof github.addIssueLabels === "function") {
    await github.addIssueLabels(issueNumber, ["gitdocs-sync-decided", ...extraLabels]);
  }
}

async function createBackfillPullRequest({ repoDir, github, translator, targetLang, config = readConfig(repoDir) }) {
  validateConfig(config);
  enforcePlanLimits(repoDir, config);
  const sourceRoot = join(repoDir, config.docs_dir);
  const sourceDocs = listMarkdownFiles(sourceRoot).filter((sourceDoc) => !isIgnored(`${config.docs_dir}${sourceDoc}`, config.ignore));
  const targetRoot = config.output_dir.replace("{locale}", targetLang);
  const files = {};
  const plannedPaths = [];
  const stats = createStats();
  const translationMemory = readTranslationMemory(repoDir, config, targetLang);
  const translatedEntries = await mapWithConcurrency(sourceDocs, 3, async (sourceDoc) => {
    const targetPath = `${targetRoot}${sourceDoc}`;
    if (existsSync(join(repoDir, targetPath))) return undefined;
    const content = readFileSync(join(sourceRoot, sourceDoc), "utf8");
    if (countTranslatableWords(content) > config.max_words_per_doc) {
      stats.skippedOversized.push(`${config.docs_dir}${sourceDoc}`);
      return undefined;
    }
    plannedPaths.push(targetPath);
    if (config.dry_run) return undefined;
    const translated = await translateMarkdownDocument({
      translator,
      sourceLang: config.source_lang,
      targetLang,
      content,
      filePath: sourceDoc,
      translationMemory,
      stats,
    });
    return [targetPath, translated];
  });
  Object.assign(files, Object.fromEntries(translatedEntries.filter(Boolean)));
  if (config.dry_run) {
    return { status: "dry-run-planned", plan: buildBackfillPlan(targetLang, plannedPaths) };
  }
  if (Object.keys(files).length === 0) {
    return { status: "nothing-to-sync" };
  }
  const batches = chunkEntries(Object.entries(files), 30);
  const pullRequests = [];
  for (let index = 0; index < batches.length; index += 1) {
    const batchFiles = Object.fromEntries(batches[index]);
    pullRequests.push(
      await github.createPullRequest({
        title: `[GitDocs Sync] Update ${targetLang} docs (${Object.keys(batchFiles).length} files)`,
        branch: translationBranch(config.source_lang, targetLang),
        labels: translationLabels(targetLang),
        body: renderTranslationPullRequest({
          targetLang,
          files: batchFiles,
          batchNumber: index + 1,
          totalBatches: batches.length,
          stats,
        }),
        files: batchFiles,
      }),
    );
    recordUsage(repoDir, {
      event: "backfill",
      targetLang,
      filesChanged: Object.keys(batchFiles).length,
      tmMatches: stats.tmMatches,
      newTranslations: stats.newTranslations,
      skippedOversized: stats.skippedOversized.length,
      ...stats.providerUsage,
    });
  }
  return { status: "backfill-pr-created", pullRequests };
}

function translationBranch(sourceLang, targetLang) {
  return `gitdocs-sync/${sourceLang}-to-${targetLang}`;
}

function translationLabels(targetLang) {
  return ["gitdocs-sync", `lang:${targetLang}`];
}

function buildBackfillPlan(targetLang, filePaths) {
  return chunkEntries(filePaths.map((filePath) => [filePath, null]), 30).map((batch, index, batches) => ({
    targetLang,
    batchNumber: index + 1,
    totalBatches: batches.length,
    files: batch.map(([filePath]) => filePath),
  }));
}

function createStats() {
  return {
    tmMatches: 0,
    newTranslations: 0,
    failedSegments: [],
    skippedOversized: [],
    providerUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };
}

function renderTranslationPullRequest({ targetLang, files, batchNumber = 1, totalBatches = 1, stats = createStats(), mode = "backfill" }) {
  return [
    "## GitDocs Sync Translation PR",
    "",
    `**Target:** ${targetLang}`,
    `**Changed files:** ${Object.keys(files).length}`,
    `**Batch ${batchNumber} of ${totalBatches}**`,
    `**Translation Memory matches:** ${stats.tmMatches}`,
    `**New translations:** ${stats.newTranslations}`,
    `**Failed segments:** ${stats.failedSegments.length}`,
    `**Skipped oversized files:** ${stats.skippedOversized.length}`,
    ...(stats.providerUsage.provider || stats.providerUsage.totalTokens > 0
      ? [
          `**Provider:** ${stats.providerUsage.provider || "unknown"}`,
          `**Input tokens:** ${stats.providerUsage.inputTokens}`,
          `**Output tokens:** ${stats.providerUsage.outputTokens}`,
          `**Total tokens:** ${stats.providerUsage.totalTokens}`,
        ]
      : []),
    ...(stats.skippedOversized.length > 0
      ? [
          "",
          "### Skipped oversized files",
          ...stats.skippedOversized.map((file) => `- \`${file}\``),
          "",
          "Choose one before retrying oversized files: split the file into smaller docs, upgrade for a higher limit, or skip it.",
        ]
      : []),
    ...(stats.failedSegments.length > 0
      ? [
          "",
          "### Failed segments",
          ...stats.failedSegments.map((item) => `- \`${item.filePath}\`: ${item.reason}`),
          "",
          "GitDocs Sync kept the existing target text for these segments so this PR can still be reviewed safely.",
        ]
      : []),
    "",
    "### Review notes",
    mode === "incremental"
      ? "- Only changed source docs are included in this incremental PR"
      : "- Only eligible missing files are included in this backfill PR",
    "- Please review and merge to accept these translations",
    "",
    `This PR was automatically generated by GitDocs Sync. Your documentation is now synced in ${targetLang}.`,
  ].join("\n");
}

function chunkEntries(entries, size) {
  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function translateMarkdownDocument({
  translator,
  sourceLang,
  targetLang,
  content,
  filePath,
  translationMemory,
  existingTargetContent,
  stats = createStats(),
}) {
  const lines = splitMarkdownLines(content);
  const existingTargetSegments = existingTargetContent ? extractTranslatableSegments(existingTargetContent) : [];
  const output = [];
  let index = 0;
  let segmentIndex = 0;

  if (lines[index]?.trim() === "---") {
    output.push(lines[index]);
    index += 1;
    while (index < lines.length) {
      output.push(lines[index]);
      const isClosing = lines[index].trim() === "---";
      index += 1;
      if (isClosing) break;
    }
  }

  while (index < lines.length) {
    const line = lines[index];
    if (isFenceStart(line)) {
      output.push(line);
      const fence = line.trim().slice(0, 3);
      index += 1;
      while (index < lines.length) {
        output.push(lines[index]);
        const isClosing = lines[index].trim().startsWith(fence);
        index += 1;
        if (isClosing) break;
      }
      continue;
    }
    if (isIndentedCodeLine(line)) {
      while (index < lines.length && (isIndentedCodeLine(lines[index]) || lines[index].trim() === "")) {
        output.push(lines[index]);
        index += 1;
      }
      continue;
    }
    if (isProtectedMdxLine(line)) {
      output.push(line);
      index += 1;
      continue;
    }
    const listItem = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/);
    if (listItem) {
      const existingTargetSegment = existingTargetSegments[segmentIndex];
      segmentIndex += 1;
      output.push(
        `${listItem[1]}${await translateInlineText({
          translator,
          sourceLang,
          targetLang,
          filePath,
          content: listItem[2],
          translationMemory,
          existingTargetSegment,
          stats,
        })}`,
      );
      index += 1;
      continue;
    }
    if (isTableSeparatorLine(line)) {
      output.push(line);
      index += 1;
      continue;
    }
    if (isTableRow(line)) {
      const translatedRow = [];
      const cells = splitTableRow(line);
      for (const cell of cells) {
        if (cell.trim() === "") {
          translatedRow.push(cell);
          continue;
        }
        const existingTargetSegment = existingTargetSegments[segmentIndex];
        segmentIndex += 1;
        translatedRow.push(
          await translateInlineText({
            translator,
            sourceLang,
            targetLang,
            filePath,
            content: cell.trim(),
            translationMemory,
            existingTargetSegment,
            stats,
          }),
        );
      }
      output.push(`| ${translatedRow.join(" | ")} |`);
      index += 1;
      continue;
    }
    if (line.trim() === "") {
      output.push(line);
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const existingTargetSegment = existingTargetSegments[segmentIndex];
      segmentIndex += 1;
      output.push(
        `${heading[1]} ${await translateInlineText({
          translator,
          sourceLang,
          targetLang,
          filePath,
          content: heading[2],
          translationMemory,
          existingTargetSegment,
          stats,
        })}`,
      );
      index += 1;
      continue;
    }
    const block = [];
    while (index < lines.length && isParagraphLine(lines[index])) {
      block.push(lines[index]);
      index += 1;
    }
    const existingTargetSegment = existingTargetSegments[segmentIndex];
    segmentIndex += 1;
    output.push(await translateInlineText({
      translator,
      sourceLang,
      targetLang,
      filePath,
      content: block.join("\n"),
      translationMemory,
      existingTargetSegment,
      stats,
    }));
  }

  return output.join("\n");
}

async function translateInlineText({
  translator,
  sourceLang,
  targetLang,
  filePath,
  content,
  translationMemory,
  existingTargetSegment,
  stats = createStats(),
}) {
  const exactMatch = translationMemory?.get(content);
  const hashMatch = translationMemory?.get(`hash:${hashText(content)}`);
  if (exactMatch || hashMatch) {
    stats.tmMatches += 1;
    return existingTargetSegment || exactMatch || hashMatch;
  }
  const placeholders = createPlaceholderStore(content);
  let protectedContent = content.replace(/`[^`]+`/g, (match) => protect(match, placeholders));
  protectedContent = protectedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const token = protect(url, placeholders);
    return `[${label}](${token})`;
  });
  try {
    const translated = await translateText({ translator, sourceLang, targetLang, content: protectedContent, filePath, stats });
    stats.newTranslations += 1;
    return restorePlaceholders(translated, placeholders);
  } catch (error) {
    if (existingTargetSegment) {
      stats.failedSegments.push({ filePath, reason: error.message });
      return existingTargetSegment;
    }
    throw error;
  }
}

async function translateText({ translator, sourceLang, targetLang, content, filePath, stats }) {
  if (typeof translator.translateWithUsage === "function") {
    const result = await translator.translateWithUsage({ sourceLang, targetLang, content, filePath });
    addProviderUsage(stats, result.usage || {});
    return result.text;
  }
  return translator.translate({ sourceLang, targetLang, content, filePath });
}

function addProviderUsage(stats, usage) {
  if (usage.provider) {
    stats.providerUsage.provider = stats.providerUsage.provider || usage.provider;
  }
  stats.providerUsage.inputTokens += usage.inputTokens || 0;
  stats.providerUsage.outputTokens += usage.outputTokens || 0;
  stats.providerUsage.totalTokens += usage.totalTokens || 0;
}

function readTranslationMemory(repoDir, config, targetLang) {
  const translationMemory = new Map();
  for (const record of readTranslationMemoryRecords(repoDir, config, targetLang)) {
    if (record.status !== "active") continue;
    if (record.source) {
      translationMemory.set(record.source, record.translation);
      translationMemory.set(`hash:${hashText(record.source)}`, record.translation);
    }
    if (record.source_hash) {
      translationMemory.set(`hash:${record.source_hash}`, record.translation);
    }
  }
  return translationMemory;
}

function readTranslationMemoryRecords(repoDir, config, targetLang) {
  const tmPath = join(repoDir, ".gitdocs-sync", "tm", `${config.source_lang}-${targetLang}.json`);
  if (!existsSync(tmPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(tmPath, "utf8"));
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch (error) {
    console.warn(`GitDocs Sync ignored unreadable Translation Memory at ${tmPath}: ${error.message}`);
    return [];
  }
}

function createPlaceholderStore(sourceText) {
  let prefix = `__GITDOCS_${hashText(sourceText).slice(0, 10)}_`;
  while (sourceText.includes(prefix)) {
    prefix = `__GITDOCS_${hashText(`${prefix}:${sourceText}`).slice(0, 10)}_`;
  }
  return { prefix, values: [] };
}

function protect(value, placeholders) {
  const token = `${placeholders.prefix}${placeholders.values.length}__`;
  placeholders.values.push([token, value]);
  return token;
}

function restorePlaceholders(text, placeholders) {
  return placeholders.values.reduce((result, [token, value]) => result.replaceAll(token, () => value), text);
}

async function replaceAsync(text, pattern, replacer) {
  const matches = [...text.matchAll(pattern)];
  const replacements = await Promise.all(matches.map((match) => replacer(...match)));
  let index = 0;
  return text.replace(pattern, () => replacements[index++]);
}

function extractTranslatableSegments(content) {
  const lines = splitMarkdownLines(content);
  const segments = [];
  let index = 0;
  if (lines[index]?.trim() === "---") {
    index += 1;
    while (index < lines.length) {
      const isClosing = lines[index].trim() === "---";
      index += 1;
      if (isClosing) break;
    }
  }
  while (index < lines.length) {
    const line = lines[index];
    if (isFenceStart(line)) {
      const fence = line.trim().slice(0, 3);
      index += 1;
      while (index < lines.length) {
        const isClosing = lines[index].trim().startsWith(fence);
        index += 1;
        if (isClosing) break;
      }
      continue;
    }
    if (isIndentedCodeLine(line)) {
      while (index < lines.length && (isIndentedCodeLine(lines[index]) || lines[index].trim() === "")) {
        index += 1;
      }
      continue;
    }
    if (isProtectedMdxLine(line)) {
      index += 1;
      continue;
    }
    if (line.trim()) {
      const heading = line.match(/^#{1,6}\s+(.+)$/);
      if (heading) {
        segments.push(heading[1]);
        index += 1;
        continue;
      }
      const listItem = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/);
      if (listItem) {
        segments.push(listItem[2]);
        index += 1;
        continue;
      }
      if (isTableSeparatorLine(line)) {
        index += 1;
        continue;
      }
      if (isTableRow(line)) {
        for (const cell of splitTableRow(line)) {
          if (cell.trim()) {
            segments.push(cell.trim());
          }
        }
        index += 1;
        continue;
      }
      const block = [];
      while (index < lines.length && isParagraphLine(lines[index])) {
        block.push(lines[index]);
        index += 1;
      }
      segments.push(block.join("\n"));
      continue;
    }
    index += 1;
  }
  return segments;
}

function isFenceStart(line) {
  return line.trim().startsWith("```") || line.trim().startsWith("~~~");
}

function isIndentedCodeLine(line) {
  return /^( {4}|\t)/.test(line);
}

function isParagraphLine(line) {
  return (
    line.trim() !== "" &&
    !isFenceStart(line) &&
    !isIndentedCodeLine(line) &&
    !isProtectedMdxLine(line) &&
    !/^(#{1,6})\s+/.test(line) &&
    !/^(\s*(?:[-*+]|\d+\.)\s+)/.test(line) &&
    !isTableRow(line)
  );
}

function isProtectedMdxLine(line) {
  const trimmed = line.trim();
  return (
    /^import\s+/.test(trimmed) ||
    /^export\s+/.test(trimmed) ||
    /^<\/?[A-Z][A-Za-z0-9]*(\s|>|\/>)/.test(trimmed) ||
    /^\{.*\}$/.test(trimmed)
  );
}

function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableSeparatorLine(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function splitMarkdownLines(content) {
  return content.split(/\r?\n/);
}

function hashText(text) {
  return createHash("sha256").update(text.trim()).digest("hex");
}

function validateConfig(config) {
  if (!config.source_lang) {
    throw new Error("source_lang is required in .gitdocs-sync.yml");
  }
  if (!Array.isArray(config.target_langs) || config.target_langs.length === 0) {
    throw new Error("target_langs is required in .gitdocs-sync.yml");
  }
  if (!config.output_dir.includes("{locale}")) {
    throw new Error("output_dir must include {locale}");
  }
}

const PLAN_LIMITS = {
  free: { label: "Free", maxDocs: 30, maxTargetLanguages: 1, maxWordsPerDoc: 10000 },
  pro: { label: "Pro", maxDocs: 150, maxTargetLanguages: 3, maxWordsPerDoc: 20000 },
  team: { label: "Team", maxDocs: 1000, maxTargetLanguages: 5, maxWordsPerDoc: 30000 },
};

function currentPlanLimits() {
  const plan = (process.env.GITDOCS_PLAN || "").trim().toLowerCase();
  if (!plan) return undefined;
  const limits = PLAN_LIMITS[plan];
  if (!limits) {
    throw new Error(`Unknown GitDocs Sync plan "${plan}". Generate a Free, Pro, or Team license key.`);
  }
  return limits;
}

function enforcePlanLimits(repoDir, config) {
  const limits = currentPlanLimits();
  if (!limits) return;
  if (config.target_langs.length > limits.maxTargetLanguages) {
    const languageWord = limits.maxTargetLanguages === 1 ? "language" : "languages";
    throw new Error(
      `${limits.label} plan supports ${limits.maxTargetLanguages} target ${languageWord}. Reduce target_langs or upgrade.`,
    );
  }
  const sourceRoot = join(repoDir, config.docs_dir);
  const sourceDocs = listMarkdownFiles(sourceRoot).filter((sourceDoc) => !isIgnored(`${config.docs_dir}${sourceDoc}`, config.ignore));
  if (sourceDocs.length > limits.maxDocs) {
    throw new Error(`${limits.label} plan supports ${limits.maxDocs} source docs. Reduce docs_dir scope, add ignore patterns, or upgrade.`);
  }
}

function readConfig(repoDir) {
  const configPath = join(repoDir, ".gitdocs-sync.yml");
  if (!existsSync(configPath)) {
    throw new Error("Missing .gitdocs-sync.yml");
  }
  const text = readFileSync(configPath, "utf8");
  const config = parseYamlConfig(text);
  const docsDir = ensureTrailingSlash(config.docs_dir || "docs/");
  const outputDir = ensureTrailingSlash(config.output_dir || "i18n/{locale}/docusaurus-plugin-content-docs/current/");
  const planLimits = currentPlanLimits();
  const configuredMaxWords = Number(config.max_words_per_doc || planLimits?.maxWordsPerDoc || 10000);
  return {
    source_lang: config.source_lang,
    target_langs: config.target_langs || [],
    docs_dir: docsDir,
    output_dir: outputDir,
    ignore: config.ignore || [],
    dry_run: process.env.GITDOCS_DRY_RUN === "true" || config.dry_run === "true" || config.dry_run === true,
    max_words_per_doc: planLimits ? Math.min(configuredMaxWords, planLimits.maxWordsPerDoc) : configuredMaxWords,
  };
}

function ensureTrailingSlash(value) {
  const normalized = String(value).replaceAll("\\", "/");
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function parseYamlConfig(text) {
  try {
    const yaml = require("js-yaml");
    return yaml.load(text) || {};
  } catch (_error) {
    return parseSimpleYamlConfig(text);
  }
}

function parseSimpleYamlConfig(text) {
  const lines = text.split(/\r?\n/);
  const config = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const pair = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    const value = rawValue.trim();
    if (value === "") {
      const values = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const item = next.match(/^\s*-\s+(.+)$/);
        if (!item) break;
        values.push(unquote(item[1].trim()));
        i += 1;
      }
      config[key] = values;
    } else if (value.startsWith("[") && value.endsWith("]")) {
      config[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
    } else {
      config[key] = unquote(value);
    }
  }
  return config;
}

function createAudit(repoDir, config) {
  const sourceRoot = join(repoDir, config.docs_dir);
  const sourceDocs = listMarkdownFiles(sourceRoot).filter((sourceDoc) => !isIgnored(`${config.docs_dir}${sourceDoc}`, config.ignore));
  const oversizedDocs = new Set(
    sourceDocs.filter((sourceDoc) => countTranslatableWords(readFileSync(join(sourceRoot, sourceDoc), "utf8")) > config.max_words_per_doc),
  );
  const byLanguage = {};
  for (const locale of config.target_langs) {
    const targetRoot = join(repoDir, config.output_dir.replace("{locale}", locale));
    const targetDocs = new Set(listMarkdownFiles(targetRoot));
    const translationMemory = readTranslationMemory(repoDir, config, locale);
    let missing = 0;
    let untracked = 0;
    let oversized = 0;
    let ready = 0;
    const files = { missing: [], untracked: [], oversized: [], ready: [] };
    for (const sourceDoc of sourceDocs) {
      if (oversizedDocs.has(sourceDoc)) {
        oversized += 1;
        files.oversized.push(sourceDoc);
      } else if (!targetDocs.has(sourceDoc)) {
        missing += 1;
        files.missing.push(sourceDoc);
      } else {
        const segments = extractTranslatableSegments(readFileSync(join(sourceRoot, sourceDoc), "utf8"));
        if (segments.length > 0 && segments.every((segment) => translationMemory.has(segment))) {
          ready += 1;
          files.ready.push(sourceDoc);
        } else {
          untracked += 1;
          files.untracked.push(sourceDoc);
        }
      }
    }
    byLanguage[locale] = { missing, untracked, oversized, ready, files };
  }
  return {
    sourceDocs: sourceDocs.length,
    targetLanguages: config.target_langs,
    totals: Object.values(byLanguage).reduce(
      (totals, item) => ({
        missing: totals.missing + item.missing,
        untracked: totals.untracked + item.untracked,
        oversized: totals.oversized + item.oversized,
        ready: totals.ready + item.ready,
      }),
      { missing: 0, untracked: 0, oversized: 0, ready: 0 },
    ),
    byLanguage,
  };
}

function countTranslatableWords(markdown) {
  const withoutCodeBlocks = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/^( {4}|\t).+$/gm, " ");
  const withoutFrontMatter = withoutCodeBlocks.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, " ");
  const withoutInlineCode = withoutFrontMatter.replace(/`[^`]*`/g, " ");
  const cjkCharacters = withoutInlineCode.match(/[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/g)?.length || 0;
  const latinWords = withoutInlineCode
    .replace(/[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/g, " ")
    .replace(/`[^`]*`/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjkCharacters + latinWords;
}

function listMarkdownFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  walk(root, root, files);
  return files.sort();
}

function isIgnored(filePath, ignorePatterns) {
  const normalized = filePath.replaceAll("\\", "/");
  return ignorePatterns.some((pattern) => {
    const normalizedPattern = pattern.replaceAll("\\", "/");
    if (normalizedPattern.endsWith("/**")) {
      return normalized.startsWith(normalizedPattern.slice(0, -3));
    }
    return globToRegExp(normalizedPattern).test(normalized);
  });
}

function globToRegExp(pattern) {
  let regex = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      const after = pattern[index + 2];
      if (after === "/") {
        regex += "(?:.*/)?";
        index += 2;
      } else {
        regex += ".*";
        index += 1;
      }
    } else if (char === "*") {
      regex += "[^/]*";
    } else if (char === "?") {
      regex += "[^/]";
    } else {
      regex += escapeRegExp(char);
    }
  }
  return new RegExp(`${regex}$`);
}

function escapeRegExp(char) {
  return char.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function walk(root, current, files) {
  for (const entry of readdirSync(current)) {
    const fullPath = join(current, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(root, fullPath, files);
    } else if (entry.endsWith(".md") || entry.endsWith(".mdx")) {
      files.push(relative(root, fullPath).replaceAll("\\", "/"));
    }
  }
}

function renderAuditIssue(audit) {
  const languageList = audit.targetLanguages.join(", ");
  return [
    "# Translation sync audit",
    "",
    "GitDocs Sync scanned your Docusaurus docs and found the current translation status.",
    "",
    "## Summary",
    "",
    "| Item | Count |",
    "|---|---:|",
    `| Source docs | ${audit.sourceDocs} |`,
    `| Target languages | ${languageList} |`,
    `| Missing files | ${audit.totals.missing} |`,
    `| Untracked files | ${audit.totals.untracked} |`,
    `| Oversized files | ${audit.totals.oversized} |`,
    `| Ready for incremental sync | ${audit.totals.ready} |`,
    "",
    "<details>",
    "<summary>Language details</summary>",
    "",
    ...audit.targetLanguages.flatMap((locale) => {
      const item = audit.byLanguage[locale];
      return [
        `### ${locale}: missing ${item.missing}, untracked ${item.untracked}, oversized ${item.oversized}, ready ${item.ready}`,
        "",
        ...["missing", "untracked", "oversized", "ready"].flatMap((kind) => [
          `**${kind}**`,
          ...(item.files[kind].length > 0 ? item.files[kind].map((file) => `- \`${file}\``) : ["- None"]),
          "",
        ]),
      ];
    }),
    "</details>",
    "",
    "## Recommended next step",
    "",
    "Comment one command:",
    "",
    "`/gitdocs sync all`",
    "",
    ...audit.targetLanguages.map((locale) => `\`/gitdocs sync ${locale}\``),
    "",
    "`/gitdocs future-only`",
    ...(audit.totals.oversized > 0
      ? [
          "",
          "## Oversized files",
          "",
          "Some files are over the configured limit and will not be translated automatically.",
          "Choose one before retrying them: split the file into smaller docs, upgrade for a higher limit, or skip it.",
        ]
      : []),
    "",
    "This audit does not consume translation quota.",
  ].join("\n");
}

function unquote(value) {
  return value.replace(/^["']|["']$/g, "");
}

module.exports = { runGitDocsSync };

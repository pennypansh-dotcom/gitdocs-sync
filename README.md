# GitDocs Sync

Auto-sync Docusaurus docs translations.

GitDocs Sync watches your Docusaurus docs in GitHub, translates only changed or missing Markdown/MDX docs, and opens translation PRs for your team to review. It is not a CMS and not a hosted docs site. It stays inside the Git workflow your team already uses.

## Who It Is For

GitDocs Sync is built for product and developer-tool teams where docs affect acquisition, activation, retention, and support quality.

It is a fit if:

- your docs are built with Docusaurus
- your docs live in GitHub
- you already have or want multiple language versions
- one or more translated versions regularly fall behind
- your team prefers reviewing docs changes through PRs

## What It Does

- scans your source docs
- creates a first-run translation audit Issue
- accepts repo-member commands such as `/gitdocs sync zh`
- translates missing or changed docs
- preserves Markdown front matter, code blocks, inline code, and link URLs
- opens translation PRs split into batches of 30 files
- writes Translation Memory only after PR merge
- opens a reviewable Translation Memory PR for future reuse
- records privacy-safe usage metadata without storing source or translated document bodies
- shows provider and token usage in translation PRs when available

## Quick Start

Add `.gitdocs-sync.yml`:

```yml
source_lang: en
target_langs:
  - zh

docs_dir: docs/
output_dir: "i18n/{locale}/docusaurus-plugin-content-docs/current/"

ignore:
  - docs/changelog.md
  - docs/internal/**

dry_run: true
max_words_per_doc: 10000
```

Add `.github/workflows/gitdocs-sync.yml`:

```yml
name: GitDocs Sync

on:
  push:
    branches: [main]
    paths:
      - "docs/**/*.md"
      - "docs/**/*.mdx"
  issue_comment:
    types: [created]
  pull_request:
    types: [closed]

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  sync-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pennypansh-dotcom/gitdocs-sync@v0.1.0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          dry_run: "true"
          license_key: ${{ secrets.GITDOCS_LICENSE_KEY }}
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          # Add OPENAI_API_KEY later when you enable non-Chinese target languages.
          # OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

For local development inside this repository, use `uses: ./`.

If the official repository name changes before launch, replace `pennypansh-dotcom/gitdocs-sync@v0.1.0` with the final published Action slug and release tag.

## First Run

1. Register for a free GitDocs Sync key, then add it as `GITDOCS_LICENSE_KEY` in GitHub Secrets.
2. Keep `dry_run: true`.
3. Run the workflow.
4. Open the audit Issue created by GitDocs Sync.
5. Comment one command:
   - `/gitdocs sync all`
   - `/gitdocs sync zh`
   - `/gitdocs sync zh,ja`
   - `/gitdocs future-only`
6. Switch to `dry_run: false` only when you are ready to create real translation PRs.

## License Key

Free and dry-run usage also require a GitDocs Sync key. This keeps trials trackable and helps prevent abuse.

Add the key as a GitHub repository secret:

```text
GITDOCS_LICENSE_KEY
```

Plan limits are enforced by the Action:

| Plan | Source docs | Target languages | Words per doc |
|---|---:|---:|---:|
| Free | 30 | 1 | 10,000 |
| Pro | 150 | 3 | 20,000 |
| Team | 1,000 | 5 | 30,000 |

If a repo is over its plan limit, GitDocs Sync stops before calling the translation provider and explains whether to reduce scope, add ignore patterns, or upgrade.

Branding footer rules for the launch MVP:

- Free and open-source sponsored usage keeps the GitDocs Sync footer in generated PR descriptions.
- Pro, Team, and Enterprise customers can ask us to remove the branding footer during manual onboarding.

The launch MVP uses manual registration and manual provisioning. OAuth login, dashboard-based plan management, and automatic billing enforcement are planned after the first customer wave proves demand.

## Provider Keys

GitDocs Sync supports any LLM provider with an OpenAI-compatible chat completions API. You have two options:

### Option A: Custom Provider (recommended — use any model)

Set a single API key, base URL, and model name. All translation directions use this provider.

| Secret | Required | Description |
|---|---|---|
| `GITDOCS_API_KEY` | Yes | Your API key |
| `GITDOCS_API_BASE_URL` | Yes | API base URL (e.g. `https://api.openai.com/v1`, `https://api.deepseek.com`, `https://api.anthropic.com/v1`, `https://api.moonshot.cn/v1`) |
| `GITDOCS_API_MODEL` | No | Model name (default: `gpt-4o-mini`) |

Works with: OpenAI, DeepSeek, Claude, Moonshot/Kimi, Qwen, Zhipu, Ollama, LM Studio, any OpenAI-compatible endpoint.

### Option B: DeepSeek + OpenAI (legacy auto-routing)

Chinese directions use DeepSeek, non-Chinese use OpenAI. Both are optional and can serve as fallback for each other.

| Secret | Purpose |
|---|---|
| `DEEPSEEK_API_KEY` | Chinese translation |
| `OPENAI_API_KEY` | Non-Chinese translation |
| `DEEPSEEK_BASE_URL` | Override DeepSeek endpoint |
| `DEEPSEEK_MODEL` | Override DeepSeek model |
| `OPENAI_BASE_URL` | Override OpenAI endpoint |
| `OPENAI_MODEL` | Override OpenAI model |

### Example: Custom Provider

```yml
env:
  GITDOCS_API_KEY: ${{ secrets.GITDOCS_API_KEY }}
  GITDOCS_API_BASE_URL: ${{ secrets.GITDOCS_API_BASE_URL }}
  GITDOCS_API_MODEL: ${{ secrets.GITDOCS_API_MODEL }}
```

### Example: DeepSeek + OpenAI

```yml
env:
  DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Cost Protection

Oversized docs are skipped before translation. GitDocs Sync tells you to choose one of three options before retrying:

- split the file into smaller docs
- upgrade for a higher limit
- skip it

This keeps the MVP predictable and prevents one huge Markdown file from consuming the plan budget.

## Try The Demo

See `examples/docusaurus-demo`, `docs/github-test-repo-setup.md`, `docs/live-dry-run.md`, `docs/live-smoke-runbook.md`, and `docs/troubleshooting.md`.

## Why GitDocs Sync

If your Docusaurus project has multi-language docs, you have four options. Here is how they compare for a typical team managing docs in 3 languages with ~100 Markdown files:

| | Manual Translation | Crowdin / Transifex | Generic AI Translation API | GitDocs Sync |
|---|---|---|---|---|
| **Setup time** | 0 (already have humans) | 2–4 hours | 1–2 hours (write scripts) | 5 minutes (drop-in workflow file) |
| **Per-update effort** | Hours (re-translate changed docs) | Open Crowdin, upload, wait for translators | Re-run scripts, fix broken code blocks | Zero — triggered by push |
| **Markdown preservation** | Depends on translator | Often breaks code blocks and front matter | Breaks unless you write guards | Preserves front matter, code blocks, inline code, links ✅ |
| **Translation Memory** | None (human memory) | Built-in (proprietary) | None (every call is cold) | Git-native TM — stored as Markdown in your repo, reusable across runs |
| **Review workflow** | Manual PR review | Crowdin review UI | Manual PR review | Git-native PRs — same review flow your team already uses |
| **Cost (100 docs, 3 langs)** | Free (labor) | $100–$300/month | ~$10/month (API calls) + script maintenance | Free (30 docs, 1 lang) / $19/month (Pro) |
| **Vendor lock-in** | None | High (proprietary TM + workflow) | None (you own the scripts) | None — TM is Markdown in your repo, workflow file is standard GitHub Actions |

**The short version:** Manual translation works for small teams but doesn't scale. Crowdin solves scale but locks you into a proprietary workflow and often breaks Markdown. DIY API scripts give you control but require ongoing maintenance and guarding every edge case. GitDocs Sync is built specifically for Docusaurus + GitHub — it knows Markdown structure, only translates what changed, and stays inside the PR workflow your team already uses.

### Open Source

GitDocs Sync is open source (MIT). You can read the source, fork it, and run it yourself. The GitHub Action in the Marketplace is the same code, with a license key to support development.

## FAQ

### Does GitDocs Sync replace human translators?

No. It produces AI-generated translation drafts that your team reviews through PRs, exactly like reviewing code. Think of it as an automatic first pass — your reviewers still control what gets merged.

### What happens to code blocks and front matter?

GitDocs Sync detects and preserves them. Code blocks, inline code, YAML front matter, HTML tags, and URLs are never sent to the translation provider. Only Markdown paragraph text and headings are translated.

### Can I use my own LLM provider?

Yes. GitDocs Sync supports any OpenAI-compatible chat completions API — set `GITDOCS_API_KEY`, `GITDOCS_API_BASE_URL`, and `GITDOCS_API_MODEL`. Works with OpenAI, DeepSeek, Claude, Moonshot/Kimi, Qwen, Zhipu, Ollama, and LM Studio.

### How is this different from just running a script that calls the DeepSeek API?

Three things: (1) GitDocs Sync only translates docs that actually changed — it diffs your repo and skips all unchanged files. (2) It preserves Markdown structure automatically — code blocks, front matter, links are not sent to the LLM. (3) Translation Memory means repeated phrases don't cost you tokens every run.

### What happens if the translation is wrong?

Your team reviews every translation PR before merging — nothing enters your docs without a human clicking "Merge." If something looks off, you can comment on the PR, edit the file directly, or run `/gitdocs sync` again for that file.

### Does it support languages other than Chinese?

Yes. Chinese (zh) is the default and most tested target. Any language supported by your LLM provider works — set `target_langs` in `.gitdocs-sync.yml` (e.g. `ja`, `ko`, `fr`, `de`, `es`, `pt`).

### How much does it cost?

- **Free:** 30 source docs, 1 target language, 10,000 words per doc
- **Pro:** $19/month — 150 source docs, 3 target languages, 20,000 words per doc
- **Team:** $99/month — 1,000 source docs, 5 target languages, 30,000 words per doc

All plans include unlimited runs, Translation Memory, and multi-provider support.

### Is there a self-hosted option?

The Action is open source (MIT). You can run your own fork without a license key if you don't need plan enforcement or support. The Marketplace listing and license key fund ongoing development.

## Development

Run tests:

```powershell
npm.cmd test
```

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

## How GitDocs Sync Compares

| | Manual | Crowdin / TMS | GitDocs Sync |
|---|---|---|---|
| Setup time | none | hours–days | ~3 min |
| Who reviews | whoever remembers to | dedicated translators | anyone, via normal PR |
| Cost model | your time | seats / word volume | per translated doc |
| Re-translates unchanged content? | no (if you remember) | depends on config | no, by design |
| Best fit | tiny docs, 1 language | big team, human translators | solo/small teams, technical docs |

GitDocs Sync is not a replacement for a translation management platform. If you have dedicated translators and a formal localization workflow, a TMS like Crowdin or Lokalise is still the right tool. GitDocs Sync is for teams that just want their Docusaurus docs to stop drifting out of sync across languages, and prefer reviewing translation changes through the same PR workflow they already use.

## FAQ

### Does this replace a translation management platform for large teams?

No — if you have dedicated translators and a formal localization workflow, a TMS is still the right tool. This is for teams that don't have that and just want the docs to stop drifting.

### What happens to code blocks and links?

They're left untouched. Only the prose gets sent for translation; Markdown/MDX structure, front matter, and code fences are protected.

### Does it re-translate the whole file every time?

No — that's the whole point. Only the changed paragraphs get sent for translation; unchanged content is skipped and translation memory covers repeats.

### Is it free for open source?

Yes. Public repositories use GitDocs Sync for free. The Free plan covers up to 30 documents, 1 target language, and 1 repository. Pro and Team plans are available for larger needs.

### What languages work best?

DeepSeek handles Chinese translation natively. OpenAI covers all other languages. For languages with fewer training resources, a human review pass is recommended before publishing.

### Where does GitDocs Sync fit in the Docusaurus ecosystem?

Docusaurus does not have an official i18n translation tool — the community is free to build tooling. GitDocs Sync fills that gap as a community-built GitHub Action that outputs directly into Docusaurus' standard `i18n/{locale}/docusaurus-plugin-content-docs/current/` directory structure.

## Development

Run tests:

```powershell
npm.cmd test
```

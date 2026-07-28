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

- Chinese directions use DeepSeek: add `DEEPSEEK_API_KEY`.
- Non-Chinese directions use OpenAI: add `OPENAI_API_KEY` later when you enable those target languages.

### Custom Provider Endpoints

Both providers support `baseUrl` and `model` overrides via environment variables, useful for API proxies, Azure OpenAI, or self-hosted endpoints:

| Secret | Purpose | Default |
|---|---|---|
| `DEEPSEEK_BASE_URL` | Override DeepSeek API base URL | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Override DeepSeek model name | `deepseek-chat` |
| `OPENAI_BASE_URL` | Override OpenAI API base URL | `https://api.openai.com` |
| `OPENAI_MODEL` | Override OpenAI model name | `gpt-4o-mini` |

Example workflow snippet for a proxy:

```yml
env:
  DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
  DEEPSEEK_BASE_URL: ${{ secrets.DEEPSEEK_PROXY_URL }}
```

## Cost Protection

Oversized docs are skipped before translation. GitDocs Sync tells you to choose one of three options before retrying:

- split the file into smaller docs
- upgrade for a higher limit
- skip it

This keeps the MVP predictable and prevents one huge Markdown file from consuming the plan budget.

## Try The Demo

See `examples/docusaurus-demo`, `docs/github-test-repo-setup.md`, `docs/live-dry-run.md`, `docs/live-smoke-runbook.md`, and `docs/troubleshooting.md`.

## Development

Run tests:

```powershell
npm.cmd test
```

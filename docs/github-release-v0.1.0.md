# GitDocs Sync v0.1.0 - Docusaurus Action MVP

First runnable MVP of GitDocs Sync: a GitHub Action that keeps Docusaurus multilingual docs in sync through reviewable pull requests.

## What It Does

- Scans Docusaurus Markdown/MDX docs.
- Creates a first-run sync audit Issue.
- Translates missing or changed docs.
- Preserves front matter, code blocks, inline code, links, MDX imports/JSX, lists, and tables.
- Opens translation PRs for maintainers to review and merge.
- Writes Translation Memory only after merged translation PRs, through a reviewable TM PR.
- Reuses Translation Memory for exact matches in later incremental syncs.

## Start With Dry-Run

Use dry-run first:

```yaml
dry_run: "true"
```

Dry-run creates an audit or plan without creating translation PRs or calling a translation provider.

## Required Setup

Every run requires a GitDocs Sync key, including Free and dry-run usage:

```text
GITDOCS_LICENSE_KEY
```

Chinese translation directions use:

```text
DEEPSEEK_API_KEY
```

Non-Chinese directions can use:

```text
OPENAI_API_KEY
```

Do not send API keys, GitHub tokens, card details, or private document content to GitDocs Sync support. Keep provider keys and license keys inside your own GitHub repository secrets.

## Current MVP Limits

| Plan | Source docs | Target languages | Words per doc |
|---|---:|---:|---:|
| Free | 30 | 1 | 10,000 |
| Pro | 150 | 3 | 20,000 |
| Team | 1,000 | 5 | 30,000 |

Oversized docs and out-of-plan scopes stop before provider calls.

## Not Included Yet

- Hosted docs site.
- CMS or online editor.
- Dashboard-based account management.
- Automatic Stripe-to-license provisioning.
- Glossary management.
- Semantic drift scoring.

These are intentionally outside the first MVP so Docusaurus teams can test the core PR workflow quickly.

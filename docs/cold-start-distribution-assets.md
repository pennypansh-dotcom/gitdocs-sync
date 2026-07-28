# GitDocs Sync Cold-Start Distribution Assets

Use these after the public Action release, landing page, and smoke test are ready.

Core message:

```text
Auto-sync Docusaurus docs translations through GitHub PRs.
```

Do not position GitDocs Sync as a generic AI translation tool, CMS, or hosted docs platform.

Before posting, replace these placeholders with real links:

```text
LANDING_PAGE_URL=https://pawsitivetime.com/
GITHUB_ACTION_URL=https://github.com/pennypansh-dotcom/gitdocs-sync
SMOKE_TEST_EVIDENCE_URL=PASTE_PUBLIC_OR_SCREENSHOT_LINK_AFTER_LIVE_SMOKE
```

## GitHub Marketplace listing

Name:

```text
GitDocs Sync
```

Short description:

```text
Auto-sync Docusaurus docs translations through reviewable GitHub PRs.
```

Long description:

```text
GitDocs Sync keeps Docusaurus multilingual docs current when source docs change.

It scans configured Markdown/MDX docs, creates a first-run sync audit Issue, translates missing or changed docs, protects code/front matter/links/MDX structures, and opens translation PRs for review.

It is not a CMS, not a hosted docs site, and not a generic translation tool. It stays inside the GitHub workflow your documentation team already uses.
```

Primary link:

```text
https://pawsitivetime.com/
```

Install link:

```text
https://github.com/pennypansh-dotcom/gitdocs-sync
```

## Docusaurus Awesome List

PR title:

```text
Add GitDocs Sync for Docusaurus translation PRs
```

PR body:

```text
Hi, I built GitDocs Sync, a GitHub Action for teams maintaining multilingual Docusaurus docs.

It watches source Markdown/MDX docs, translates missing or changed content, preserves Docusaurus structures, and opens reviewable translation PRs.

It is focused on Docusaurus docs workflows rather than being a generic translation service.
```

List entry:

```text
- [GitDocs Sync](https://github.com/pennypansh-dotcom/gitdocs-sync) - GitHub Action that auto-syncs Docusaurus docs translations through reviewable PRs.
```

## Show HN

Title:

```text
Show HN: I built a GitHub Action that auto-syncs Docusaurus docs translations
```

Body:

```text
I built GitDocs Sync for teams whose Docusaurus docs are part of their product.

The problem: source docs move every week, but translated docs fall behind. Existing localization tools are often heavier than what a small product/docs team wants.

GitDocs Sync stays inside GitHub:
- scans Docusaurus Markdown/MDX docs
- creates a first-run sync audit Issue
- translates missing or changed docs
- preserves front matter, code blocks, links, MDX, lists, and tables
- opens translation PRs for review
- saves Translation Memory only after merge

It is not a CMS and not a hosted docs platform. The current MVP starts with Docusaurus and GitHub Actions.

Landing page: https://pawsitivetime.com/
Action: https://github.com/pennypansh-dotcom/gitdocs-sync
Smoke test evidence: SMOKE_TEST_EVIDENCE_URL
```

## Product Hunt

Tagline:

```text
Auto-sync Docusaurus docs translations through GitHub PRs
```

Description:

```text
GitDocs Sync is a GitHub Action for product and developer-tool teams whose Docusaurus translations fall behind source docs.

It scans Markdown/MDX docs, protects code and front matter, translates missing or changed content, and opens reviewable pull requests. Start with dry-run to get a sync audit before any translation provider calls.
```

First comment:

```text
I built GitDocs Sync because many small docs-as-product teams do not need a full localization platform. They need translated Docusaurus docs to keep up with source docs without leaving GitHub.

The MVP is intentionally narrow:
- Docusaurus Markdown/MDX
- GitHub Actions
- reviewable translation PRs
- Translation Memory after merge
- Free dry-run registration before any real provider usage

Landing page: LANDING_PAGE_URL
Action: GITHUB_ACTION_URL
Smoke test evidence: SMOKE_TEST_EVIDENCE_URL
```

## Reddit

Use in r/docusaurus or relevant docs threads only when it answers the discussion.

Short reply:

```text
If your issue is Docusaurus translations falling behind after source docs change, I built a small GitHub Action for that: GitDocs Sync.

It opens translation PRs instead of adding a CMS or separate editor. It is very specifically for Docusaurus Markdown/MDX docs.

https://pawsitivetime.com/

Smoke test evidence:
SMOKE_TEST_EVIDENCE_URL
```

Post draft:

```text
Title: Keeping Docusaurus translations in sync through GitHub PRs

I have been working on GitDocs Sync, a GitHub Action for Docusaurus teams with multilingual docs.

It does a dry-run audit first, then can create translation PRs for missing or changed Markdown/MDX docs. The idea is to keep the normal GitHub review flow instead of adding a translation dashboard.

Useful if your docs are part of the product and translated versions regularly fall behind.

Current MVP: Docusaurus + GitHub Actions + DeepSeek/OpenAI provider keys.

Landing page: LANDING_PAGE_URL
Action: GITHUB_ACTION_URL
Smoke test evidence: SMOKE_TEST_EVIDENCE_URL
```

## Direct outreach to docs consultants

Subject:

```text
Small GitHub Action for Docusaurus translation PRs
```

Email:

```text
Hi,

I am building GitDocs Sync, a GitHub Action for product teams whose Docusaurus translations fall behind source docs.

It watches Markdown/MDX docs, translates missing or changed content, protects Docusaurus structures, and opens GitHub translation PRs for review.

I thought it might be useful for docs consultants who manage several product docs sites and want a lighter option than a full localization platform.

The first run can stay in dry-run mode and only creates a sync audit Issue.

Landing page:
https://pawsitivetime.com/

Action:
https://github.com/pennypansh-dotcom/gitdocs-sync

Smoke test evidence:
SMOKE_TEST_EVIDENCE_URL

If you have a Docusaurus client where translations are lagging, I would be happy to help run the first dry-run.
```

## What to avoid

- Do not claim support for Mintlify, Nextra, OpenAPI, JSON strings, or broad localization workflows until shipped.
- Do not say "AI translation platform".
- Do not promise quality review, semantic drift detection, or glossary management in the MVP.
- Do not ask users to share API keys or private document content.

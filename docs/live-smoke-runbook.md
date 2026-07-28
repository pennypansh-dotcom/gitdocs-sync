# GitDocs Sync Live Smoke Runbook

Use this runbook when validating the commercial MVP in a real GitHub repository.

## Target User Lens

This smoke test is for documentation-as-product teams using Docusaurus. It should prove the one pain they care about:

> English docs changed, translated docs stay in sync through normal GitHub PR review.

Do not add dashboard, editor, CMS, glossary, or broad file-format checks to this smoke test.

## Test Repository

Verified repo:

```text
https://github.com/pennypansh-dotcom/gitdocs-sync-docusaurus-smoke
```

Keep the repo private unless it is intentionally being used as a public demo.

## Required Setup

- GitHub Actions permissions:
  - `contents: write`
  - `pull-requests: write`
  - `issues: write`
- GitHub Actions secret:
  - `GITDOCS_LICENSE_KEY`
  - `DEEPSEEK_API_KEY`
- `.gitdocs-sync.yml`:
  - `source_lang: en`
  - `target_langs: [zh]`
  - `dry_run: false` for the real smoke test

Before running the GitHub workflow, validate the smoke repo from this product repo:

```powershell
npm.cmd run smoke:validate -- --repo-dir "C:\path\to\gitdocs-sync-docusaurus-smoke"
```

This must print `Smoke repo validated.` and show:

- `Action: pennypansh-dotcom/gitdocs-sync@v0.1.0`
- `dry_run: false`

If it says the repo uses `uses: ./`, stop. That means the smoke repo is still testing local source code instead of the published Action customers will install.

## Pass Criteria

The MVP live smoke passes only when all of these work in GitHub:

1. Workflow run creates or updates the audit Issue.
2. `/gitdocs sync zh` from a repo writer creates a real translation PR.
3. The translation PR preserves Docusaurus front matter, code blocks, inline code, and links.
4. Merging the PR opens a reviewable Translation Memory PR.
5. A later English docs edit creates an incremental PR.
6. The incremental PR reuses Translation Memory and only translates new text.
7. If a closed sync branch already exists, the next run creates or reuses a fresh safe branch without force-resetting old work.
8. The new PR is `mergeable: true` and `mergeable_state: clean`.

## Verified Evidence

- Backfill PR merged: `https://github.com/pennypansh-dotcom/gitdocs-sync-docusaurus-smoke/pull/2`
- Incremental PR merged: `https://github.com/pennypansh-dotcom/gitdocs-sync-docusaurus-smoke/pull/3`
- Earlier stale-branch behavior was verified in `https://github.com/pennypansh-dotcom/gitdocs-sync-docusaurus-smoke/pull/5`; current hardened behavior avoids force-reset and needs a fresh smoke after release.
- Latest verified TM record count on `main`: 12
- Latest verified local test run: `npm.cmd test`, 120 passed

## Cost Check

For the TM reuse smoke, the PR body should show many `Translation Memory matches` and only a small number of `New translations`.

Verified example:

```text
Translation Memory matches: 7
New translations: 2
Provider: deepseek
Total tokens: 117
```

If a tiny docs edit causes the whole document to be newly translated, stop and inspect Translation Memory before inviting users.

## Known Follow-Ups

- Use `pennypansh-dotcom/gitdocs-sync@v0.1.0` for the first official smoke unless the release repo changes before launch.
- Decide whether closed `gitdocs-sync/...` branches should be deleted after merge or kept for auditability.
- Add one public demo only after the private smoke test remains stable.

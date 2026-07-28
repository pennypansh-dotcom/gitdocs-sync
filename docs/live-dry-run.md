# GitDocs Sync Live Dry-Run Checklist

Use this checklist to validate the MVP in a real GitHub repository without spending translation quota.

## Goal

Confirm that GitDocs Sync can:

- read a Docusaurus docs repo
- create the first-run audit Issue
- accept an authorized `/gitdocs` command
- plan translation PRs without calling DeepSeek when `dry_run: true`

## Setup

1. Create a private test repo or fork a small Docusaurus docs repo.
2. Copy the demo `docs`, `i18n`, `.gitdocs-sync.yml`, and `.github` folders into the repo root.
3. If this is not the GitDocs Sync Action repository, change the workflow step from `uses: ./` to the published Action, for example `uses: pennypansh-dotcom/gitdocs-sync@v0.1.0`.
4. Keep `.gitdocs-sync.yml` set to `dry_run: true`.
5. Add repository secrets:
   - `GITDOCS_LICENSE_KEY`
   - `DEEPSEEK_API_KEY`
   - `OPENAI_API_KEY` is not required for the first Chinese-only smoke test
6. Confirm the workflow has:
   - `contents: write`
   - `pull-requests: write`
   - `issues: write`

## Run

1. Start the `GitDocs Sync` workflow in GitHub Actions.
2. Open the audit Issue created by the workflow.
3. Comment one command:
   - `/gitdocs sync zh`
   - `/gitdocs sync all`
   - `/gitdocs future-only`
4. Check the Actions run result.

## Expected Result

With `dry_run: true`:

- no translation provider call is made
- no PR is created
- the returned plan lists the files that would be included in PRs

With `dry_run: false`:

- missing target-language files are translated
- PRs are split into batches of 30 files
- existing language PRs are reused instead of opening duplicates
- `.gitdocs-sync/usage.jsonl` records privacy-safe usage metadata only

## Cleanup

If you created real PRs:

1. Close the PRs you do not want to merge.
2. Delete `gitdocs-sync/...` branches.
3. Leave the audit Issue open if you want to run another command.

## Common Failures

- Missing GitHub token: pass `github_token: ${{ secrets.GITHUB_TOKEN }}`.
- Missing license key: add `GITDOCS_LICENSE_KEY` and pass it as `license_key`.
- Missing permissions: add `contents: write`, `pull-requests: write`, and `issues: write`.
- Missing provider key: add `DEEPSEEK_API_KEY` for the first Chinese test. Add `OPENAI_API_KEY` later for non-Chinese directions.
- Oversized docs: lower the file size or upgrade the plan before translating the full file.

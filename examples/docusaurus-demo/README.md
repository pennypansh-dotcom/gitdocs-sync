# GitDocs Sync Docusaurus Demo

This fixture shows the intended MVP path for a Docusaurus repo.

## What to try

1. For local Action development, copy this demo's `docs`, `i18n`, `.gitdocs-sync.yml`, and `.github` folders into the root of this Action repository.
   For a separate customer docs repo, change the workflow step from `uses: ./` to the published GitDocs Sync Action, for example `uses: pennypansh-dotcom/gitdocs-sync@v0.1.0`.
2. Keep `dry_run: true` for the first run.
3. Add `GITDOCS_LICENSE_KEY` and `DEEPSEEK_API_KEY` as repository secrets. `OPENAI_API_KEY` can be added later when testing non-Chinese target languages.
4. Run the workflow from GitHub Actions.
5. Confirm that GitDocs Sync creates a translation sync audit Issue.
6. Comment `/gitdocs sync zh` on the audit Issue.
7. In dry-run mode, confirm that the workflow reports the planned PR files without calling the translation provider.
8. Switch `dry_run` to `false` only when you are ready to create real PRs.

## Expected audit

- `intro.md` is missing in `zh`.
- `guide.md` exists in `zh` and is therefore `Untracked`.
- `changelog.md` is ignored.

## Required workflow permissions

The workflow needs these permissions:

- `contents: write`
- `pull-requests: write`
- `issues: write`

If the workflow can open the audit Issue but cannot create PRs, check these permissions first.

## Safe cleanup after a test run

If a test run creates a branch or PR you do not want to keep:

1. Close the GitDocs Sync PR in GitHub.
2. Delete the `gitdocs-sync/...` branch from the GitHub branch list.
3. Keep or close the audit Issue. Keeping it is useful if you want to run another `/gitdocs` command.

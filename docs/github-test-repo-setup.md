# GitHub Test Repository Setup

Use one private repository for the first real GitDocs Sync smoke test.

## Recommended Name

Use:

```text
gitdocs-sync-docusaurus-smoke
```

Why this name works:

- `gitdocs-sync` makes it easy to search later
- `docusaurus` keeps the test tied to the MVP target
- `smoke` signals that this repo is for first-run validation, not production

## Repository Settings

Create the repository as:

- Visibility: private
- README: optional
- `.gitignore`: none
- License: none

The first smoke test should stay small and controlled.

## Files To Add

Copy these from `examples/docusaurus-demo` into the repo root:

- `.gitdocs-sync.yml`
- `.github/workflows/gitdocs-sync.yml`
- `docs/`
- `i18n/`

If the repo is separate from the Action source code, update the workflow:

```yml
- uses: pennypansh-dotcom/gitdocs-sync@v0.1.0
```

If the Action source code is inside the same repo, keep:

```yml
- uses: ./
```

## Secrets

For the first smoke test, add only:

```text
GITDOCS_LICENSE_KEY
DEEPSEEK_API_KEY
```

Add `OPENAI_API_KEY` later when testing non-Chinese target languages.

## First Run

1. Add the free GitDocs Sync key as `GITDOCS_LICENSE_KEY`.
2. Keep `dry_run: true`.
3. Run the workflow.
4. Confirm the audit Issue is created.
5. Comment:

```text
/gitdocs sync zh
```

6. Confirm no provider call is made in dry-run mode.
7. Switch `dry_run` to `false` only when ready to create a real translation PR.

## Success Criteria

The smoke test passes when:

- the audit Issue appears
- `/gitdocs sync zh` is accepted from a repo writer
- dry-run reports planned files without creating a PR
- real mode creates a translation PR
- merging the translation PR updates Translation Memory or opens a Translation Memory PR

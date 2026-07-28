# Persist Translation Memory After Translation PR Merge

## Status

Accepted

## Context

GitDocs Sync uses Translation Memory to reduce repeated provider calls and keep future translations more consistent. The MVP runs inside GitHub Actions, so any file written only to the runner workspace disappears after the workflow ends.

If Translation Memory is not persisted back to the repository, the product still creates translation PRs, but it loses one of the main cost-control and quality loops after every run.

Directly committing Translation Memory to the base branch is risky for a commercial documentation workflow because it bypasses the same PR review path that customers use for translated docs.

## Decision

When a GitDocs Sync translation PR is merged, GitDocs Sync writes the active Translation Memory file and opens a separate Translation Memory PR.

The merge event is recognized by PR labels:

- `gitdocs-sync`
- `lang:<locale>`

The stored Translation Memory lives under:

```text
.gitdocs-sync/tm/<source>-<target>.json
```

## Consequences

- Future sync runs can reuse exact matches without calling the translation provider.
- Translation Memory remains Git-native and reviewable.
- No source or translated document bodies are stored in a backend service.
- The workflow needs `contents: write` permission.
- TM updates no longer bypass branch protection or customer review.
- This keeps the MVP small while preserving the product's cost-control loop.

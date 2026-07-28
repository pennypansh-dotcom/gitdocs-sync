# GitDocs Sync Troubleshooting

Use this when the workflow starts but does not finish the expected audit or PR flow.

## GitHub token is missing

Add this to the workflow step:

```yml
with:
  github_token: ${{ secrets.GITHUB_TOKEN }}
```

## License key is missing

Free and dry-run usage also require a GitDocs Sync key.

Add this to the workflow step:

```yml
with:
  license_key: ${{ secrets.GITDOCS_LICENSE_KEY }}
```

Then add `GITDOCS_LICENSE_KEY` as a GitHub repository secret.

## GitHub permissions are missing

Add these workflow permissions:

```yml
permissions:
  contents: write
  pull-requests: write
  issues: write
```

Without these permissions, GitDocs Sync may read the repo but fail to create Issues, branches, or PRs.

## Main branch is protected

After a translation PR is merged, GitDocs Sync tries to save Translation Memory back to the repo.

If direct commits to the main branch are blocked, GitDocs Sync opens a Translation Memory PR instead. Merge that PR so future sync runs can reuse exact translation matches.

## Translation key is missing

For Chinese directions, add:

```text
DEEPSEEK_API_KEY
```

For non-Chinese directions, add:

```text
OPENAI_API_KEY
```

Add them as GitHub repository secrets.

## A sync PR already exists

GitDocs Sync reuses the open PR for the same language branch, updates its body, and adds a short comment.

If you want a clean retry:

1. Close the old sync PR.
2. Delete the `gitdocs-sync/...` branch.
3. Run the workflow again.

## A file is too large

Oversized files are skipped before translation to protect plan cost.

Choose one:

- split the file into smaller docs
- upgrade for a higher limit
- skip it

## The workflow uses `uses: ./` but fails in a customer repo

`uses: ./` only works when the Action code is inside the same repository.

In a customer docs repo, use the published Action instead:

```yml
- uses: pennypansh-dotcom/gitdocs-sync@v0.1.0
```

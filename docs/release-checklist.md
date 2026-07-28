# GitDocs Sync Release Checklist

Use this checklist to publish the first customer-installable GitDocs Sync Action release.

## Recommended Release

```text
pennypansh-dotcom/gitdocs-sync@v0.1.0
```

If the product moves to a company organization later, keep the same repository name and update docs in one pass.

## Before Tagging

- [ ] Confirm `action.yml` points to `dist/index.js`.
- [ ] Run `npm.cmd test` and confirm all tests pass.
- [ ] Run `npm.cmd run build` so `dist/index.js` is current.
- [ ] Run `npm.cmd run release:check` and confirm release readiness is OK.
- [ ] Confirm `LICENSE`, `README.md`, `.github/workflows/test.yml`, `package.json`, `package-lock.json`, `src/`, `test/`, `docs/`, and `dist/` are in the release repo.
- [ ] Confirm README examples reference `pennypansh-dotcom/gitdocs-sync@v0.1.0`.
- [ ] Confirm the README tells users to start with `dry_run: "true"`.
- [ ] Confirm the README tells users that Free and dry-run usage require `GITDOCS_LICENSE_KEY`.
- [ ] Confirm `docs/customer-onboarding-pack.md` and `docs/launch-risk-runbook.md` are available before inviting customers.
- [ ] Use `docs/github-release-v0.1.0.md` as the GitHub Release body.
- [ ] Keep `docs/launch-day-runbook.md` handy for the live release sequence.
- [ ] Validate final launch inputs with `npm.cmd run launch:validate -- --url https://YOUR_DOMAIN --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK --repo owner/repo --smoke-repo owner/smoke-repo`.
- [ ] If the final site URL and payment links are known, run `npm.cmd run launch:configure -- --url https://YOUR_DOMAIN --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK`.
- [ ] Generate the first smoke-test key with `npm.cmd run license -- free smoke`.

## Publish Steps

1. Create or open the official GitHub repository:

```text
https://github.com/pennypansh-dotcom/gitdocs-sync
```

2. Upload or push the release-ready project files.
3. Create tag `v0.1.0`.
4. Create a GitHub Release from tag `v0.1.0`.
5. Use this release title:

```text
GitDocs Sync v0.1.0 - Docusaurus Action MVP
```

6. Use this release summary:

```text
First runnable MVP of GitDocs Sync: a GitHub Action that scans Docusaurus docs, creates a sync audit Issue, translates missing or changed Markdown/MDX docs through reviewable PRs, and writes Translation Memory only after merge.

Start with dry_run: "true" before creating real translation PRs.
```

## After Publishing

- [ ] Run the live smoke test using `pennypansh-dotcom/gitdocs-sync@v0.1.0`.
- [ ] Update the landing page CTA to the GitHub release URL.
- [ ] Prepare GitHub Marketplace listing copy.
- [ ] Keep payment and customer provisioning manual until first-customer demand is proven.

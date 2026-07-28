# GitDocs Sync Launch Day Runbook

Use this on the day you are ready to go live.

## 1. Preflight

Run:

```powershell
npm.cmd run release:check
```

Then validate the values you are about to use:

```powershell
npm.cmd run launch:validate -- --url https://YOUR_DOMAIN --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK --repo owner/repo --smoke-repo owner/smoke-repo
```

Confirm the package still has:

- `action.yml` pointing to `dist/index.js`
- Marketplace branding
- launch notes
- onboarding pack
- payment and site configuration scripts

## 2. Configure The Site

When the final domain is ready:

```powershell
npm.cmd run site:url -- --url https://YOUR_DOMAIN
```

When Stripe payment links are ready:

```powershell
npm.cmd run payment:links -- --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK
```

If both are ready at once, use:

```powershell
npm.cmd run launch:configure -- --url https://YOUR_DOMAIN --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK
```

## 3. Publish The Release

1. Create tag `v0.1.0`.
2. Publish the GitHub Release.
3. Paste the body from `docs/github-release-v0.1.0.md`.
4. Confirm the release points to `pennypansh-dotcom/gitdocs-sync@v0.1.0`.

## 4. Smoke Test

Run the published Action from a clean repo, not `uses: ./`. This is the live smoke test.

First validate the smoke repo setup from your local product repo:

```powershell
npm.cmd run smoke:validate -- --repo-dir "C:\path\to\gitdocs-sync-docusaurus-smoke"
```

Verify:

- dry-run works
- audit Issue appears
- authorized translation PR appears
- merged translation creates a TM PR
- later edits create incremental PRs

## 5. First Customer Setup

For each customer:

- collect repo URL
- collect source and target languages
- generate a license key
- send the onboarding email from `docs/customer-onboarding-pack.md`
- record the customer in `docs/manual-customer-ledger-template.csv`

Do not ask for API keys, tokens, card details, or private document content. Support mail is `pawsitiveme@outlook.com`.

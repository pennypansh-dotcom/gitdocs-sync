# GitDocs Sync Tomorrow Launch Operator Checklist

Use this as the one-page operating checklist for the MVP launch day.

## Goal

Get GitDocs Sync into a state where a first customer can discover it, register for a key, pay for Pro or Team, install the Action, run dry-run, and create a real translation PR without us building a dashboard.

## Local Preflight

Run these from the product repo:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run release:check
```

Expected result:

- tests pass
- build produces `dist/index.js`
- release readiness prints `Release readiness: OK`

## User Actions Needed

These require access outside the local codebase.

1. GitHub release

   - Confirm the official repo is `pennypansh-dotcom/gitdocs-sync`.
   - Push the latest files.
   - Create tag `v0.1.0`.
   - Publish a GitHub Release using `docs/github-release-v0.1.0.md`.

2. Stripe Payment Links

   - Create Pro at `$19/month`.
   - Create Team at `$99/month`.
   - Use Stripe-hosted checkout.
   - Enable automatic receipts.
   - Review tax, refund, and basic fraud settings.
   - Set success pages:
     - `https://pawsitivetime.com/payment-success.html`
     - `https://pawsitivetime.com/zh-payment-success.html`

3. Public site URL

   - Confirm the final HTTPS domain.
   - Host the static files in `site/`.
   - Make sure `/`, `/zh.html`, `/payment-success.html`, and `/zh-payment-success.html` open.

4. Smoke repo

   - Update the smoke repo workflow to use `pennypansh-dotcom/gitdocs-sync@v0.1.0`, not `uses: ./`.
   - Add `GITDOCS_LICENSE_KEY` and `DEEPSEEK_API_KEY` as GitHub Secrets.
   - Run dry-run first, then run live smoke with `dry_run: false`.

## Configure Launch Inputs

When domain and Stripe links are ready, validate first:

```powershell
npm.cmd run launch:validate -- --url https://YOUR_DOMAIN --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK --repo pennypansh-dotcom/gitdocs-sync --smoke-repo pennypansh-dotcom/gitdocs-sync-docusaurus-smoke
```

Then apply site URL and payment links:

```powershell
npm.cmd run launch:configure -- --url https://YOUR_DOMAIN --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK
```

Run release check again:

```powershell
npm.cmd run release:check
```

## Live Smoke Gate

Validate the local checkout of the smoke repo before running GitHub Actions:

```powershell
npm.cmd run smoke:validate -- --repo-dir "C:\path\to\gitdocs-sync-docusaurus-smoke"
```

It must show:

- `Action: pennypansh-dotcom/gitdocs-sync@v0.1.0`
- `dry_run: false`
- `Smoke repo validated.`

Then verify in GitHub:

- dry-run creates the audit Issue without provider calls
- `/gitdocs sync zh` creates a real translation PR
- merge opens a reviewable Translation Memory PR
- a later source-doc edit creates an incremental PR

## First Customer Flow

1. Customer requests Free, Pro, or Team through the site or `pawsitiveme@outlook.com`.
2. For Pro or Team, send the matching Stripe Payment Link or let them self-serve from the site.
3. Generate license key:

   ```powershell
   npm.cmd run license -- free customer-name
   npm.cmd run license -- pro customer-name
   npm.cmd run license -- team customer-name
   ```

4. Record customer in `docs/manual-customer-ledger-template.csv`.
5. Send the matching email from `docs/customer-onboarding-pack.md`.
6. Ask them to run dry-run before real PRs.

## Do Not Launch If

- GitHub release is not tagged.
- Smoke repo still uses `uses: ./`.
- Stripe links are missing or not reviewed.
- Public site still points paid buttons to email when paid self-serve is intended.
- Any support message asks for API keys, GitHub tokens, card details, or private document content.

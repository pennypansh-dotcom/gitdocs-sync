# GitDocs Sync First-Customer Readiness

Use this Go/No-Go checklist before contacting the first 10-30 customers.

## Go/No-Go

Go only when these are true:

- The published Action is available at `pennypansh-dotcom/gitdocs-sync@v0.1.0`.
- A live smoke test has run from a clean repo using the published Action, not `uses: ./`.
- The smoke test proves dry-run audit, approved translation PR, merge, Translation Memory PR, and one later incremental PR.
- Stripe Payment Links exist for Pro at $19/month and Team at $99/month.
- The landing page Pro and Team buttons have been updated with `npm.cmd run payment:links -- --pro-url ... --team-url ...`.
- Payment success pages tell customers to send only billing email, GitHub repo URL, plan, source language, target languages, and docs framework.
- Support mail is working at `pawsitiveme@outlook.com`.
- Free, Pro, and Team license keys can be generated with `npm.cmd run license -- <plan> <customer>`.
- README, landing page, onboarding pack, and troubleshooting docs all tell customers to start with dry-run.

No-Go if any of these are true:

- The Action release has not been tagged.
- The latest smoke test still uses local files instead of the published Action.
- Stripe links have not been checked in the Stripe console.
- The landing page still points paid users only to a placeholder when paid checkout is intended.
- Any customer-facing message asks for card details, GitHub tokens, DeepSeek keys, OpenAI keys, or private document content.

## Manual First-Customer Flow

1. Customer asks for Free, Pro, or Team.
2. For Pro or Team, send the matching Stripe Payment Link.
3. After payment, collect only the repo URL, source language, target languages, and docs framework.
4. Generate a license key locally.
5. Send the matching onboarding email from `docs/customer-onboarding-pack.md`.
6. Ask the customer to run dry-run first.
7. Review the audit Issue with them before they create real translation PRs.

## Safety Rules

- Do not ask customers for API keys, GitHub tokens, card details, or private docs.
- Ask customers to store keys in their own GitHub Secrets.
- Keep plan changes manual until the first customer wave proves demand.
- Record every customer, repo, plan, license key, payment status, and support note in the private manual ledger.

## Evidence To Capture

- GitHub Release URL.
- Live smoke workflow run URL.
- Audit Issue URL.
- Translation PR URL.
- Translation Memory PR URL.
- Stripe Pro Payment Link.
- Stripe Team Payment Link.
- Final landing page URL.

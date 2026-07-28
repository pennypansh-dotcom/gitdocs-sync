# GitDocs Sync Development Status

## Current slice

TDD is active on the real runnable MVP path. The code is intentionally small and uses Node.js built-in tests. The GitHub Action is bundled with `@vercel/ncc` so runtime dependencies such as `js-yaml` are available in real GitHub Actions.

## Implemented behavior

- First run creates a lightweight GitHub Issue-style sync audit.
- `.gitdocs-sync.yml` is read and validated before work starts.
- First-run audit classifies files as `Missing`, `Untracked`, `Oversized`, and truly computed `Ready`.
- `.gitdocs-sync.yml` prefers `js-yaml` parsing and supports inline arrays; a small fallback parser keeps the local no-build Action path runnable.
- Oversized source docs are blocked before translation.
- `/gitdocs` Issue commands from users without repo write permission do not trigger sync.
- Authorized `/gitdocs sync zh` creates backfill translation PR data.
- Backfill PRs are split into batches of 30 files.
- Markdown translation preserves front matter, fenced code blocks, tilde code blocks, indented code blocks, inline code, and link URLs.
- Consecutive prose lines are translated as one paragraph block to reduce provider calls and improve translation consistency.
- Markdown front matter is preserved for both Unix and Windows line endings.
- Push events create incremental translation PR data for changed docs.
- Push events fall back to Translation Memory drift detection when GitHub does not provide a reliable changed-file list.
- Incremental PRs are split into 30-file batches, matching backfill PR behavior.
- Backfill and incremental translation now use a small file-level concurrency limit of 3 to reduce runtime without flooding providers.
- Translation Memory is read once per target language run instead of repeatedly inside each file loop.
- Existing language branches are reused only when an open sync PR exists; otherwise GitDocs Sync creates a fresh branch instead of force-resetting old work.
- Merged translation PR events write active Translation Memory.
- Translation Memory writes fail closed when source and target segment counts do not align, avoiding polluted TM data.
- Corrupt Translation Memory JSON is ignored with a warning instead of crashing the Action.
- Incremental sync reuses exact active TM matches without calling the translator.
- `/gitdocs sync zh,ja` and `/gitdocs sync all` create separate language PRs.
- `ignore` supports exact file paths and simple `dir/**` prefixes.
- Provider router supports DeepSeek for Chinese directions and OpenAI for non-Chinese directions.
- DeepSeek and OpenAI HTTP provider adapters are implemented behind the router.
- `dry_run: true` plans backfill PRs without creating PRs or calling translation providers.
- `dry_run: true` also plans push-triggered incremental PRs without creating PRs or calling translation providers.
- `action.yml` exposes a `dry_run` input; default remains real PR creation.
- `action.yml` points to the bundled `dist/index.js` Action entrypoint.
- GitHub API adapter supports audit Issue upsert, Issue comments, collaborator permissions, and PR creation through GitHub REST APIs.
- `action.yml` and `src/action.js` read GitHub event payloads and wire the GitHub/provider adapters.
- PR creation passes stable language branch names such as `gitdocs-sync/en-to-zh`.
- GitHub API adapter continues when the language branch already exists.
- `examples/docusaurus-demo` provides a dry-run Docusaurus fixture with docs, config, workflow, and README.
- Translation PR bodies report Translation Memory matches, new translations, and skipped oversized files.
- Provider adapters expose token usage metadata for cost tracking.
- Backfill and incremental runs write privacy-safe usage metadata, including provider token totals when available.
- Duplicate PR attempts reuse an existing open PR for the same language branch and add a short update comment.
- Reused sync branches can retry file writes with the existing file sha when GitHub requires it.
- GitHub file writes stop after a second sha conflict instead of retrying recursively.
- `/gitdocs future-only` is implemented and confirms that first-run backfill is skipped.
- Missing translation provider keys now point customers to the right GitHub secret: `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`.
- Oversized files now show the customer choices directly in the audit Issue and PR body: split the file, upgrade, or skip it.
- `docs/live-dry-run.md` documents the real GitHub dry-run validation path.
- The demo workflow now explains when `uses: ./` is valid and when a customer repo should point to the published Action.
- Root `README.md` now acts as the GitHub Action landing page and quick-start guide.
- Action entrypoint now gives clear setup messages for missing repository context and missing `github_token`.
- Removed the unused `gitdocs_sync_key` Action input to keep the MVP setup path lean.
- Added `docs/troubleshooting.md` for first-run setup failures.
- Translation PR bodies now include the lightweight GitDocs Sync generated-by footer for passive product exposure.
- Incremental PR bodies now use incremental-specific review notes instead of backfill wording.
- Translation PRs now receive `gitdocs-sync` and `lang:<locale>` labels so merged PRs can update Translation Memory.
- Merged translation PRs now open a reviewable Translation Memory PR instead of writing directly to the base branch.
- Added ADR 0020 documenting why Translation Memory must be persisted after PR merge through a PR.
- Translation PR bodies now show provider and token usage when the provider returns usage metadata.
- Translation provider requests and GitHub REST requests retry transient 429/5xx failures.
- Translation provider requests and GitHub REST requests include timeouts so a hung provider does not stall the Action until GitHub kills it.
- GitHub audit Issue lookup paginates through open `gitdocs-sync` issues to avoid duplicate audit Issues in busy repos.
- GitHub API error messages redact token-like values before logging.
- Provider prompts mark Markdown content as untrusted document data and instruct the model not to follow instructions inside the source document.
- Markdown placeholder protection now uses per-line unique tokens to avoid replacing customer text that happens to look like an internal token.
- Chinese characters, Japanese kana, and Korean hangul count toward max document limits so CJK docs cannot bypass cost protection by lacking spaces.
- Incremental sync preserves existing target translations for unchanged Translation Memory matches instead of overwriting the whole target document.
- Removed source docs are marked for deletion in translation PRs.
- Segment-level translation failures keep existing target text when possible and are listed in the PR body.
- Provider routing can fall back to the secondary provider and marks fallback usage.
- Markdown protection covers common Docusaurus MDX imports, exports, JSX tags, JSX expressions, list items, and table rows.
- Link URLs are protected while the containing segment is translated only once.
- Audit Issues include collapsible language/file details and idempotent `/gitdocs` decisions through labels.
- `ignore` now supports common glob wildcards such as `docs/**/*.draft.md` and `docs/private/*.md`.
- Action failures now include stack context for debugging instead of only printing the top-level message.
- Demo and onboarding docs now default to a DeepSeek-first Chinese smoke test; OpenAI is documented as a later add-on for non-Chinese directions.
- Added `docs/github-test-repo-setup.md` with the recommended private test repo name and setup path.
- Added CI workflow, `.gitignore`, and MIT `LICENSE` for publication readiness.
- Free and dry-run runs now require `GITDOCS_LICENSE_KEY` through the `license_key` Action input or environment.
- Action-side Free/Pro/Team plan limits are enforced before translation provider calls: source docs, target languages, and words per doc.
- Landing pages now include English/Chinese SEO metadata, GEO-friendly summary copy, Open Graph/Twitter metadata, JSON-LD, `robots.txt`, and `sitemap.xml`.
- Added `docs/launch-risk-runbook.md` for Stripe Payment Links safety, manual provisioning, LLM provider cost boundaries, prompt injection, high usage, refunds, and accidental key exposure.
- Added `docs/customer-onboarding-pack.md` with free key, paid customer, support intake, and manual customer ledger templates.
- Added `docs/cold-start-distribution-assets.md` with GitHub Marketplace, Docusaurus Awesome List, Show HN, Reddit, and docs consultant outreach copy.
- Cold-start distribution assets now also include Product Hunt copy and a `SMOKE_TEST_EVIDENCE_URL` placeholder for launch proof.
- Added Stripe payment success handoff pages: `site/payment-success.html` and `site/zh-payment-success.html`.
- Added `docs/stripe-payment-links-setup.md` for Pro/Team Stripe Payment Link setup.
- Added `scripts/generate-license-key.js` and `npm.cmd run license -- <plan> <customer>` for manual first-customer license key generation.
- Added `scripts/verify-release-ready.js` and `npm.cmd run release:check` for local release-package readiness checks.
- Added `scripts/configure-payment-links.js` and `npm.cmd run payment:links -- --pro-url ... --team-url ...` so live Stripe Payment Links can be applied without hand-editing HTML.
- Added `scripts/configure-site-url.js` and `npm.cmd run site:url -- --url ...` so the final HTTPS domain updates canonical URLs, hreflang, Open Graph URLs, `robots.txt`, and `sitemap.xml` together.
- Added `docs/first-customer-readiness.md` for the first-customer Go/No-Go decision.
- Added `docs/github-release-v0.1.0.md` as paste-ready GitHub Release copy.
- Added `docs/manual-customer-ledger-template.csv` for manual Free/Pro/Team customer tracking.
- Added `docs/site-launch-checklist.md` for final domain and payment button setup.
- Added `docs/launch-day-runbook.md` to give the exact live-release order in one page.
- Added `scripts/validate-launch-inputs.js` and `npm.cmd run launch:validate` for preflight validation of URL, repo, and Stripe inputs.
- Release readiness now checks SEO/GEO metadata, required Free/dry-run registration, readable Chinese site copy, payment safety handoff, and large-model API risk safeguards.
- Site tests now guard against common mojibake markers and validate landing-page JSON-LD so customer-facing Chinese pages and SEO/GEO metadata stay usable.
- Added `docs/tomorrow-launch-operator-checklist.md` as the one-page launch day operating checklist covering GitHub release, Stripe links, site URL, smoke repo, and first-customer flow.

## Verification

Run:

```powershell
npm.cmd test
```

Latest result: 122 tests passed on 2026-07-27.

Live smoke repo:

- Repo: `https://github.com/pennypansh-dotcom/gitdocs-sync-docusaurus-smoke`
- Backfill PR verified and merged: `https://github.com/pennypansh-dotcom/gitdocs-sync-docusaurus-smoke/pull/2`
- Incremental PR verified and merged: `https://github.com/pennypansh-dotcom/gitdocs-sync-docusaurus-smoke/pull/3`
- TM reuse was previously verified in the smoke repo. The old stale-branch reset behavior has now been replaced locally with fresh branch creation to avoid losing work.
- Latest push Action result: success, `GitDocs Sync finished: incremental-pr-created`
- Previous live merge Action result: success, Translation Memory on `main` had 12 active records. Local behavior now opens a TM PR instead of direct main writes and needs a fresh live smoke after publishing this update.
- Verified on the PR branch and after merge: `i18n/zh/docusaurus-plugin-content-docs/current/intro.md` keeps `id: intro` and translates the new body text.

## Next recommended slices

1. Create or sync the official `pennypansh-dotcom/gitdocs-sync` repo and publish tag `v0.1.0`.
2. Create Stripe Payment Links for Pro and Team, then replace email-only purchase CTAs.
3. Run a fresh live smoke with `GITDOCS_LICENSE_KEY` before outreach.
4. Keep OAuth, automated paid plan enforcement, anomaly detection, and usage dashboard as Sprint 2 commercial backend work.

## Product decisions confirmed

- Support both DeepSeek and OpenAI. Use DeepSeek first for live testing.
- Default Action behavior should create real PRs. `dry_run: true` is a safety mode, not the MVP success path.

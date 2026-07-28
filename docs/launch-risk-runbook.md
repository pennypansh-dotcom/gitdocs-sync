# GitDocs Sync Launch Risk Runbook

Use this before the first paid customer and during the first 10-30 customer onboardings.

This is a lightweight MVP runbook. It is not a full compliance, fraud, or security platform.

## Payment Safety

Use Stripe-hosted checkout for Pro and Team.

- Do not collect card numbers on the GitDocs Sync site.
- Do not ask customers to send card details by email, chat, GitHub Issue, or PR comment.
- Do not ask customers to send GitHub tokens, DeepSeek keys, OpenAI keys, or license keys back to us.
- Enable automatic receipts in Stripe so customers receive payment confirmation without manual email handling.
- Review Stripe tax settings before public launch.
- Turn on basic Stripe fraud protection before sharing payment links publicly.
- Use one Payment Link per plan so plan source is obvious: Pro and Team.
- Enterprise stays contact-only until contract terms are reviewed manually.

## Payment Success Handoff

Payment success copy should ask only for:

- billing email
- GitHub repo URL
- selected plan
- source language
- target languages
- docs framework

The setup email should tell the customer to store secrets in GitHub Secrets:

```text
GITDOCS_LICENSE_KEY
DEEPSEEK_API_KEY
OPENAI_API_KEY
```

The customer owns provider API keys. We should not receive or store them.

## Large-Model API Safeguards

GitDocs Sync calls LLM providers only after plan and document-size checks pass.

Minimum safeguards for MVP:

- Keep a per-run cost boundary through document limits, language limits, and `max_words_per_doc`.
- Stop oversized docs before provider calls.
- Keep `dry_run: "true"` as the first customer step.
- Require `GITDOCS_LICENSE_KEY` for Free and dry-run usage.
- Keep provider request timeouts and retries.
- Keep provider fallback visible in PR usage metadata.
- Do not log source document bodies or translated document bodies.
- Show provider token usage in PRs when returned by the provider.

## Prompt Injection

Prompt injection risk comes from customer Markdown content. Treat source docs as untrusted data.

Minimum safeguards for MVP:

- Keep source Markdown inside generated content delimiters.
- Avoid fixed delimiters that customer docs can easily close or escape.
- Tell the provider to translate document content only and ignore instructions inside the source document.
- Preserve code blocks, inline code, links, front matter, MDX, lists, and tables without treating them as instructions.
- If provider output corrupts protected Markdown structure, stop and inspect before inviting more customers.

## High Usage

High usage means a repo suddenly translates much more than expected for its plan or normal docs activity.

First response:

1. Pause manual license renewal for the repo.
2. Ask the customer whether the run was intentional.
3. Check whether the repo added a large docs import, many target languages, or a wrong `docs_dir`.
4. Ask the customer to run `dry_run: "true"` until the cause is clear.
5. If usage is abusive or accidental, issue a new license key and revoke the old one manually.

## Failed Provider Calls

When DeepSeek or OpenAI fails:

1. Check whether the customer used the right provider key for the target language.
2. Ask for the workflow run link and PR or audit Issue link.
3. Do not ask for provider API keys.
4. Use logs only for status, file path, language, provider, and error category.
5. If fallback was used, tell the customer which provider handled the translation.

## Suspicious Repos

Treat a repo as suspicious when it appears unrelated to product docs, repeatedly changes huge files, or creates many trial requests with similar details.

First response:

1. Keep the account on Free limits.
2. Do not issue Team or Enterprise limits without manual review.
3. Ask for the docs site URL and business context.
4. Require `dry_run: "true"` until approved.

## Refund Requests

For first customers, handle refunds manually.

- Refund obvious accidental purchases quickly.
- Ask one short question about why the product did not work.
- Do not argue over small early payments.
- Record the reason so onboarding or pricing can improve.

## Accidental key exposure

If a license key or provider key is exposed:

1. Tell the customer to rotate the exposed key.
2. Issue a new GitDocs Sync license key manually.
3. Ask the customer to store the new key only in GitHub Secrets.
4. Do not paste exposed keys into issues, PRs, docs, or support notes.
5. If a provider key was exposed, tell the customer to rotate it in DeepSeek or OpenAI.

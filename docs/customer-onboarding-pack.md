# GitDocs Sync Customer Onboarding Pack

Use these templates for the first 10-30 customers while provisioning is still manual.

Do not send us API keys, GitHub tokens, card details, or private document content. Customers should store secrets only in their own GitHub repository secrets.

## Free dry-run key reply

Subject:

```text
Your GitDocs Sync free dry-run key
```

Body:

```text
Hi,

Here is your GitDocs Sync free dry-run key:

GITDOCS_LICENSE_KEY=PASTE_KEY_HERE

Please add it in GitHub:

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

Secret name:
GITDOCS_LICENSE_KEY

Then add your provider key:
DEEPSEEK_API_KEY

Do not send us API keys. Keep DeepSeek, OpenAI, GitHub, and GitDocs Sync keys inside your own GitHub Secrets.

Start with dry_run: "true". GitDocs Sync will create a sync audit Issue first, without creating translation PRs or calling the translation provider.

If you get stuck, reply with:
- GitHub repo URL
- workflow run link
- audit Issue link, if one was created
- a short error summary

GitDocs Sync
```

## Paid customer reply

Subject:

```text
GitDocs Sync setup for your plan
```

Body:

```text
Hi,

Thanks for trying GitDocs Sync.

Your plan:
PLAN_NAME

Your GitDocs Sync license key:
GITDOCS_LICENSE_KEY=PASTE_KEY_HERE

Please add it as a GitHub repository secret named:
GITDOCS_LICENSE_KEY

Also add your translation provider key:
- DEEPSEEK_API_KEY for Chinese target languages
- OPENAI_API_KEY for non-Chinese target languages, if enabled

Do not send us API keys, GitHub tokens, card details, or private document content.

Recommended first run:
1. Set dry_run: "true".
2. Run the GitDocs Sync workflow.
3. Open the sync audit Issue.
4. Comment /gitdocs sync zh or /gitdocs sync all.
5. Review the plan.
6. Switch dry_run to "false" only when ready for real translation PRs.

If you want setup help, reply with:
- GitHub repo URL
- source language
- target languages
- docs framework
- whether you already use Docusaurus i18n folders

GitDocs Sync
```

## Support intake

Ask for only these details:

- customer email
- GitHub repo URL
- workflow run link
- audit Issue link
- translation PR link
- source language
- target languages
- docs framework
- short error summary

Do not ask for:

- card details
- GitHub tokens
- DeepSeek API keys
- OpenAI API keys
- private document bodies
- full Translation Memory files

## Manual customer ledger

Keep this in a private sheet or Airtable while the MVP has no dashboard.

Start from `docs/manual-customer-ledger-template.csv`.

```csv
customer_email,github_repo,plan,license_key,status,source_language,target_languages,docs_framework,docs_limit,repo_limit,language_limit,branding_footer,paid_at,renews_at,notes
pawsitiveme@example.com,https://github.com/acme/docs,Free,gds_free_example,active,en,zh,Docusaurus,30,1,1,on,,,
```

Recommended statuses:

- `lead`
- `free-active`
- `paid-active`
- `paused`
- `refunded`
- `expired`

## License key naming

For manual keys, use a readable prefix:

```text
gds_free_YYYYMM_customer
gds_pro_YYYYMM_customer
gds_team_YYYYMM_customer
```

This is not cryptographic enforcement. It is enough for the first customer wave while payments and onboarding are manual.

The Action reads the plan from the license key and enforces these MVP limits:

| Plan | Source docs | Target languages | Words per doc |
|---|---:|---:|---:|
| Free | 30 | 1 | 10,000 |
| Pro | 150 | 3 | 20,000 |
| Team | 1,000 | 5 | 30,000 |

When customers exceed a limit, tell them to reduce the docs scope, add ignore patterns, split oversized files, or upgrade. Do not manually raise limits for early customers unless we record the reason in the ledger.

Branding footer rule for launch:

- Free and open-source sponsored usage keeps the GitDocs Sync footer in generated PR descriptions.
- Pro, Team, and Enterprise customers may request footer removal during manual onboarding.

Do not promise dashboard-based self-service, OAuth-based account management, automatic plan changes, or GitHub Marketplace billing in this launch. Those belong after the first 10-30 customers show that the narrow Docusaurus workflow is worth scaling.

Generate a key with:

```powershell
npm.cmd run license -- free acme-docs
npm.cmd run license -- pro acme-docs
npm.cmd run license -- team acme-docs
```

Then paste the generated key into the private manual customer ledger and send it in the appropriate onboarding email.

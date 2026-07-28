# Stripe Payment Links Setup

Use Stripe Payment Links for the first paid customers. Do not build custom checkout for the MVP.

## Products

Create two monthly subscription products:

```text
GitDocs Sync Pro - $19/month
GitDocs Sync Team - $99/month
```

Enterprise remains contact-only.

## Success URLs

Use these success URLs after the public site is live:

```text
https://pawsitivetime.com/payment-success.html
https://pawsitivetime.com/zh-payment-success.html
```

Use the English success URL by default unless the customer came from the Chinese page.

## Required Stripe Settings

- Use Stripe-hosted checkout.
- Enable automatic receipts.
- Review tax settings before public launch.
- Turn on basic fraud protection.
- Do not collect card details on the GitDocs Sync site.
- Do not ask customers to email card details, GitHub tokens, DeepSeek keys, OpenAI keys, or private document content.

## After Payment

The customer should send only:

- billing email
- GitHub repo URL
- plan
- source language
- target languages
- docs framework

Then issue a manual license key and send the paid customer reply from `docs/customer-onboarding-pack.md`.

Generate the key locally:

```powershell
npm.cmd run license -- pro customer-name
npm.cmd run license -- team customer-name
```

## Update Landing Page Buttons

After Stripe gives you the live links, update the Pro and Team buttons:

```powershell
npm.cmd run payment:links -- --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK
```

The script only accepts HTTPS links and only updates the Pro and Team payment buttons. Enterprise stays contact-only.

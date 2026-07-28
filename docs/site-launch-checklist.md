# GitDocs Sync Site Launch Checklist

Use this when the final public site URL is chosen.

## Configure Public URL

Update canonical URLs, language alternates, Open Graph URLs, `robots.txt`, and `sitemap.xml`:

```powershell
npm.cmd run site:url -- --url https://YOUR_DOMAIN
```

The URL must use HTTPS.

Before changing anything, validate the launch inputs:

```powershell
npm.cmd run launch:validate -- --url https://YOUR_DOMAIN --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK --repo owner/repo --smoke-repo owner/smoke-repo
```

## Configure Payment Buttons

After Stripe creates the live Pro and Team Payment Links:

```powershell
npm.cmd run payment:links -- --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK
```

Enterprise stays contact-only.

## Do Both At Once

When the domain and payment links are both ready, use one command:

```powershell
npm.cmd run launch:configure -- --url https://YOUR_DOMAIN --pro-url https://buy.stripe.com/PRO_LINK --team-url https://buy.stripe.com/TEAM_LINK
```

## Before Publishing

- Confirm the English page opens at `/`.
- Confirm the Chinese page opens at `/zh.html`.
- Confirm payment success pages open at `/payment-success.html` and `/zh-payment-success.html`.
- Confirm Free CTA goes to the registration section.
- Confirm Pro and Team buttons go to Stripe after links are configured.
- Confirm Contact links use `pawsitiveme@outlook.com`.

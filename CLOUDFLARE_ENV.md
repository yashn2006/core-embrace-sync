# Cloudflare Pages / Workers — Environment Variables

Add these under **Workers & Pages → your project → Settings → Variables & Secrets**.
Mark everything **Encrypted (Secret)** except items tagged (public).

## Required

| Name | Where to get it | Notes |
|------|-----------------|-------|
| `SUPABASE_URL` | Supabase → Project Settings → API | (public) also `VITE_SUPABASE_URL` for build |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → API keys | (public) also `VITE_SUPABASE_PUBLISHABLE_KEY` for build |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys | server only, never expose |
| `LOVABLE_API_KEY` | auto-provisioned by Lovable | powers AI + connectors |
| `OPENAI_API_KEY` | platform.openai.com → API keys | optional, only if you switch AI to OpenAI direct |
| `RESEND_API_KEY` | resend.com → API keys | daily digest + auth emails |
| `RESEND_FROM_EMAIL` | e.g. `CoreEgin <noreply@coreegin.com>` | verified sender |
| `APP_URL` | `https://sales.coreegin.com` | used in email links |
| `DAILY_API_KEY` | daily.co → Developers | video meeting rooms |
| `VAPID_PUBLIC_KEY` | generated | web push |
| `VAPID_PRIVATE_KEY` | generated | web push |
| `VAPID_SUBJECT` | `mailto:you@coreegin.com` | web push contact |

## How to add on Cloudflare

1. Open your Pages project → **Settings** → **Variables and Secrets**.
2. Click **Add variable** → name, value, choose **Encrypt** for secrets.
3. Add for both **Production** and **Preview** environments.
4. Redeploy so the Worker picks them up (`Deployments → Retry deployment`).

## DNS for the domain `coreegin.com`

- App: `sales.coreegin.com` → CNAME to your Cloudflare Pages URL (proxied 🟠).
- Resend: add the DKIM / SPF / DMARC / return-path CNAMEs Resend shows in
  **Domains → coreegin.com**. Keep them **DNS-only (grey cloud)** — Cloudflare
  proxy breaks Resend verification.
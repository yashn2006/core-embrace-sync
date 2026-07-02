# 🚀 CoreEgin — Cloudflare Environment Variables

Copy-paste checklist for **Cloudflare Pages → Settings → Environment Variables**.
Add each one under **BOTH** "Production" and "Preview" scopes unless noted.

---

## 1) Supabase (REQUIRED)

### Client-visible (frontend, prefixed `VITE_`)
| Key | Where to get it | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | `https://sgaiifxwbiottfleyuno.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API → `anon` / `publishable` key | `sb_publishable_xxx...` |
| `VITE_SUPABASE_PROJECT_ID` | Just the ref (first part of the URL) | `sgaiifxwbiottfleyuno` |

### Server-only (runtime, NO `VITE_` prefix — used by server functions)
| Key | Where to get it | Notes |
|---|---|---|
| `SUPABASE_URL` | same as VITE_SUPABASE_URL | |
| `SUPABASE_PUBLISHABLE_KEY` | same as VITE_SUPABASE_PUBLISHABLE_KEY | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key | **SECRET — never expose.** Encrypt in Cloudflare. |
| `SUPABASE_JWKS` | `https://<PROJECT_REF>.supabase.co/auth/v1/.well-known/jwks.json` (paste the JSON as one line) | Used by `requireSupabaseAuth` middleware |

---

## 2) Daily.co — Video meetings (REQUIRED for Meetings)
| Key | Where to get it |
|---|---|
| `DAILY_API_KEY` | https://dashboard.daily.co → Developers → API keys |

---

## 3) Web Push — VAPID (REQUIRED for background notifications)
| Key | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | Generate once with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | (same command — private half) **SECRET** |
| `VAPID_SUBJECT` | `mailto:you@coreegin.com` |

Also expose the public one to the frontend:
| Key | Value |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | Same as `VAPID_PUBLIC_KEY` |

---

## 4) Resend — Daily email digests (OPTIONAL but recommended)
| Key | Where to get it |
|---|---|
| `RESEND_API_KEY` | https://resend.com/api-keys — after domain `coreegin.com` is verified |
| `RESEND_FROM_EMAIL` | e.g. `noreply@coreegin.com` (must match your verified domain) |

---

## 5) Lovable AI (OPTIONAL — powers future AI features like lead scoring, chat suggestions)
| Key | Notes |
|---|---|
| `LOVABLE_API_KEY` | Provided by Lovable. Server-only. |

---

## 6) App Config (OPTIONAL)
| Key | Value |
|---|---|
| `VITE_APP_URL` | `https://coreegin.com` — used for share links and `.ics` calendar URLs |
| `NODE_VERSION` | `20` — set in Cloudflare Pages "Build settings" |

---

## 📋 Quick copy checklist

```
# --- Supabase ---
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWKS=

# --- Meetings ---
DAILY_API_KEY=

# --- Push notifications ---
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@coreegin.com
VITE_VAPID_PUBLIC_KEY=

# --- Email (Resend) ---
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@coreegin.com

# --- Optional ---
LOVABLE_API_KEY=
VITE_APP_URL=https://coreegin.com
```

---

## 🔐 Which ones to mark as "Encrypted" in Cloudflare

Toggle **Encrypt** (padlock) for:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWKS`
- `DAILY_API_KEY`
- `VAPID_PRIVATE_KEY`
- `RESEND_API_KEY`
- `LOVABLE_API_KEY`

Everything with `VITE_` prefix is **safe to be plain** — it ships to the browser anyway.

---

## ✅ After adding all vars

1. Cloudflare Pages → **Deployments** → **Retry deployment** (env vars apply on next build).
2. Open the site → sign in as owner.
3. Go to **System Health** (owner-only) — every row should be green.
4. If a row is red, that env var is missing or wrong.

---

## 🌐 Custom domain

Cloudflare Pages → **Custom domains** → **Set up a custom domain** → `coreegin.com`.
Cloudflare handles SSL automatically. Also add `www.coreegin.com` as a redirect.

Then in Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://coreegin.com`
- **Redirect URLs:** `https://coreegin.com/**`, `https://*.coreegin.com/**`
# CoreEgin — Move to your own Supabase (super simple, 3 steps)

## Before you start
- You have your Supabase project: `sgaiifxwbiottfleyuno`
- You have `coreegin.com` domain
- You have a Cloudflare account

---

## STEP 1 — Create the database (5 min)

1. Open https://supabase.com/dashboard/project/sgaiifxwbiottfleyuno
2. Left sidebar → **SQL Editor** → **+ New query**
3. Open the file **`STEP_1_schema.sql`** → select ALL → copy
4. Paste in the SQL Editor → click **Run** (or Ctrl+Enter)
5. Wait for green "Success" message
6. Left sidebar → **Storage** → **New bucket**
   - Name: `avatars` → Private → Create
   - Name: `chat-attachments` → Private → Create

**Step 1 done ✅**

---

## STEP 2 — Create your owner login (2 min)

1. Same Supabase project → Left sidebar → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Email: `parkarsaad2021@gmail.com`
4. Password: `Saad@parkar2021`
5. Turn ON **Auto Confirm User** toggle
6. Click **Create user**
7. Back to SQL Editor → **+ New query**
8. Open **`STEP_2_owner.sql`** → copy all → paste → **Run**

**Step 2 done ✅** — You are now the owner.

---

## STEP 3 — Deploy the app to Cloudflare (10 min)

### 3A. Get the code onto GitHub
1. In Lovable (this editor) → bottom-left `+` icon → **GitHub**
2. Click **Connect to GitHub** → authorize → **Create repository**
3. Wait until it says "Pushed to GitHub"

### 3B. Deploy on Cloudflare Pages
1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Pick the CoreEgin repo → **Begin setup**
3. Build settings:
   - Framework preset: **None**
   - Build command: `bun run build`
   - Output directory: `dist`
4. Click **Save and Deploy** (it will fail the first time — that's OK)

### 3C. Add environment variables
1. Cloudflare Pages project → **Settings** → **Environment variables**
2. Open **`STEP_3_env_vars.txt`**
3. For each pair (name + value) → click **Add variable** → paste name and value
4. Do this for BOTH **Production** and **Preview** environments
5. After adding all: **Deployments** → click **Retry deployment** on latest

### 3D. Connect coreegin.com
1. Cloudflare Pages project → **Custom domains** → **Set up a custom domain**
2. Type `coreegin.com` → Continue
3. It will ask you to add DNS records — do exactly what it shows
4. Wait 2-5 min → status turns green ✅

**Step 3 done ✅** — App is live at https://coreegin.com

---

## After launch (optional, 5 min)

**Enable Google login:**
Supabase → Authentication → Providers → Google → toggle ON → paste your Google OAuth Client ID + Secret from Google Cloud Console.

**Auth redirect URLs:**
Supabase → Authentication → URL Configuration
- Site URL: `https://coreegin.com`
- Redirect URLs: `https://coreegin.com/**`

**Push notifications cron:**
Supabase → Database → Extensions → enable `pg_cron` and `pg_net`.
Then SQL Editor → paste:
```sql
SELECT cron.schedule('flush-push', '* * * * *',
  $$ SELECT net.http_post(
    url:='https://sgaiifxwbiottfleyuno.supabase.co/functions/v1/send-push',
    headers:='{"Content-Type":"application/json"}'::jsonb
  ) $$);
```

---

## If something breaks — WhatsApp me these:
1. Which step number failed
2. Screenshot of the red error
3. What you clicked just before it

That's it. You've got this. 🚀

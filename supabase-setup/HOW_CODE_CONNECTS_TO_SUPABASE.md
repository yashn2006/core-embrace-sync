# How the code connects to Supabase

The CRM code is **database-agnostic** — it reads the connection from environment variables.

## Environment variables the code uses

| Env var                          | Where            | What it does                                    |
|----------------------------------|------------------|-------------------------------------------------|
| `VITE_SUPABASE_URL`              | Frontend (build) | Which Supabase project the browser talks to     |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | Frontend (build) | Public anon key (safe to expose)                |
| `SUPABASE_URL`                   | Backend (server) | Same URL, for server functions                  |
| `SUPABASE_PUBLISHABLE_KEY`       | Backend (server) | Same key, for server functions                  |
| `SUPABASE_SERVICE_ROLE_KEY`      | Backend (server) | Admin key — used for privileged writes only     |
| `DAILY_API_KEY`                  | Backend (server) | Video meetings (Daily.co)                       |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Backend | Web push notifications |
| `RESEND_API_KEY`                 | Backend (server) | Optional — daily email digest                   |

## Which database is used right now?

- **Lovable preview** → Lovable Cloud DB (already set up automatically).
- **Cloudflare Pages deployment** → whichever DB the env vars above point to.
  Set them to your Supabase project (`sgaiifxwbiottfleyuno`) values from STEP_3.

## What the app expects to exist in the target DB

All of this is created by STEP_1 → STEP_2 → STEP_4:

- Tables: `organizations`, `profiles`, `user_roles`, `leads`, `activities`,
  `messages`, `chat_reads`, `import_batches`, `meetings`, `meeting_attendees`,
  `push_subscriptions`, `push_notifications_queue`, `lost_reasons`.
- Enums: `app_role`, `lead_stage`, `lead_source`, `activity_type`, `channel_type`.
- Trigger `on_auth_user_created` → auto-creates a profile + `rep` role for every new user.
- Storage buckets: `avatars`, `chat-attachments`.
- Realtime enabled on: `messages`, `leads`, `activities`, `meetings`, `meeting_attendees`.
- Security-definer helpers in `private` schema: `has_role`, `current_org_id`, `can_view_meeting`.

## Auth settings to configure in your Supabase dashboard

1. **Authentication → URL Configuration**
   - Site URL: `https://coreegin.com`
   - Redirect URLs: `https://coreegin.com/**`
2. **Authentication → Providers → Email** → enabled (turn off "Confirm email"
   if you want instant login for team members).
3. **Project Settings → Edge Functions → Secrets** → add
   `DAILY_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   (and `RESEND_API_KEY` if using email digests).

That's it — everything else is already in the code.

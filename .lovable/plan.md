# CoreEgin Sales OS — Phase 1 Plan

Building a premium, minimal internal CRM. Dark UI, magenta accent, Linear/Notion-quality feel. Multi-tenant-safe schema from day one. Backend: Lovable Cloud (Supabase). Auth: email/password (per your ask — no public signup, owner-created accounts only). Chat via Realtime.

## Approach

Because this is a very large build, I'll ship it in 3 tight iterations inside this project. Each iteration is fully working and testable before moving to the next. All schema, RLS, and grants land in iteration 1 so nothing is refactored later.

## Iteration 1 — Foundation (this turn)
1. **Design system**: dark tokens (`#0F0F13` bg, magenta `#EC4899`, purple `#A855F7`), tabular numerals, tight motion (120–150ms ease-out), skeleton loaders, custom shadcn variants. Zero hardcoded colors in components.
2. **Full DB schema + RLS + grants** (single migration):
   - `organizations`, `profiles`, `user_roles` (enum: `owner|rep`), `leads`, `activities`, `lost_reasons`, `import_batches`, `messages`
   - `has_role()` SECURITY DEFINER function (no recursive RLS)
   - Every table: grants + RLS + policies enforcing rep-only-own-leads, owner-full-access, chat visibility rules
   - Realtime enabled on `messages`, `leads`, `activities`
   - Auto-create profile trigger on signup
3. **Auth**: `/auth` login page (email/password only, no signup UI), `_authenticated` gate, sign-out hygiene.
4. **Seed owner account**: `parkarsaad2021@gmail.com` / `Saad@parkar2021` with `owner` role (via admin-side seed).
5. **App shell**: sidebar nav, header, responsive mobile layout, route skeleton for all screens.

## Iteration 2 — Core CRM
6. **Leads**: list/table view + Kanban pipeline (drag & drop), lead detail page, add/edit lead, source tags, deal value.
7. **Activities**: quick-log widget (call/email/whatsapp/meeting/note) + timeline on lead detail.
8. **Follow-ups**: date field, quick-set buttons, overdue red flag, "my follow-ups today" panel.
9. **Won/Lost**: Won modal (deal value + handoff note); Lost modal (reason enum + note).
10. **CSV import**: upload → field-mapping step → assign whole batch to a rep → commit. Multiple sequential batches, isolated by `import_batch_id`.

## Iteration 3 — Team, Chat, Dashboards
11. **Team management** (owner): invite by email (creates auth user + role), change role, deactivate, team list with activity.
12. **Team chat**: persistent slide-out panel; org-wide "Team" channel + 1:1 DMs; Realtime; unread badges. Text only.
13. **Owner dashboard**: stat cards, pipeline funnel (recharts), rep performance table, source breakdown.
14. **Rep dashboard**: "my leads today", personal stat strip, own pipeline snapshot.
15. **Follow-up digest email**: Resend via edge function on daily cron (needs `RESEND_API_KEY` — I'll ask when we get there).

## Technical notes (for your reference)
- Roles live in `user_roles` table, never on `profiles` — avoids privilege escalation and RLS recursion.
- RLS is enforced at DB layer; no client-side role check is trusted.
- Every table has `org_id` from day one; single org row seeded now, ready for multi-tenant later.
- Realtime channels are scoped per-user via RLS so a rep can never subscribe to another rep's leads.
- Deploy target Cloudflare Pages + `coreegin.com` subdomain — the codebase is already compatible; DNS/publish is a one-click step at the end.

## Out of scope (per your brief)
Forecasting, AI features, public multi-tenant signup, billing, white-label. Later phases.

## What I need from you along the way
- Iteration 3: your Resend API key (for follow-up digest emails).
- After iteration 3: publish + connect `crm.coreegin.com` (or subdomain of your choice).

Approve and I'll start iteration 1 immediately.
# Davra

A focused network where Uzbek students share and discover useful learning resources, each as a
structured card with a short review in Uzbek. Web MVP built with Next.js and Supabase.

> The product name lives in `src/lib/site-config.ts`.

Project status: see [CHANGELOG.md](CHANGELOG.md). Design choices: [DECISIONS.md](DECISIONS.md).
Full product brief: [claude-code-prompt.md](claude-code-prompt.md) (written under the working name "Resurs").

## Requirements

- Node.js 24 (see `.nvmrc`; `nvm use`)
- pnpm (`corepack enable pnpm`)
- Docker Desktop (for the local Supabase stack)

## Local setup

```bash
nvm use
corepack enable pnpm
pnpm install

# Start Postgres, Auth, Storage, Studio and Mailpit in Docker
pnpm db:start

# Create your env file and paste the keys printed by `pnpm db:status`
cp .env.example .env.local

pnpm dev
```

Open http://localhost:3000.

Local service URLs (default ports):

| Service                       | URL                    |
| ----------------------------- | ---------------------- |
| Supabase API                  | http://127.0.0.1:54321 |
| Supabase Studio (DB UI)       | http://127.0.0.1:54323 |
| Mailpit (verification emails) | http://127.0.0.1:54324 |

## Environment variables

| Variable                               | Where           | Purpose                                                   |
| -------------------------------------- | --------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | public          | Canonical site URL, used for SEO and auth redirects       |
| `NEXT_PUBLIC_SUPABASE_URL`             | public          | Supabase project URL                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public          | Supabase publishable key (RLS applies)                    |
| `SUPABASE_SECRET_KEY`                  | **server only** | Supabase secret key; bypasses RLS. Never expose or commit |
| `CRON_SECRET`                          | **server only** | Token for the scheduled link check (see below); optional  |

`pnpm build` first runs `scripts/check-env.ts`: a missing or malformed variable fails the build with its
name (never its value) instead of deploying a site that answers every request with "Internal Server Error".
URLs must include `https://`. On Vercel, mark only `SUPABASE_SECRET_KEY` as sensitive; `NEXT_PUBLIC_*`
values are compiled into the browser bundle anyway. After changing a variable, redeploy.

## Supabase cloud setup

1. Create a project at https://supabase.com (pick the region closest to your users and Vercel functions;
   we use Central EU, Frankfurt). Security options: keep **Enable Data API** and **Automatically expose new
   tables** on — the migrations revoke and re-grant access table by table, and the server's secret key
   relies on the default grants. **Enable automatic RLS** can stay off: every migration enables RLS itself.
2. Project Settings → API Keys: copy the URL, the publishable key and a secret key into `.env.local`
   (and later into Vercel).
3. Authentication → URL Configuration: set **Site URL** to your production URL and add
   `http://localhost:3000/**` and `https://<your-domain>/**` to **Redirect URLs**.
4. Authentication → Providers → Email: keep **Confirm email** enabled and set **Minimum password length**
   to 8 (the forms ask for 8; this makes the server enforce it too).
5. Before inviting real users, set up a custom SMTP provider (Authentication → Emails → SMTP Settings).
   Supabase's built-in sender only delivers to members of your Supabase team and only a few emails per
   hour, so it is enough for testing with your own address but not for students.
6. Once SMTP is set up (Supabase only allows editing templates then), Authentication → Emails →
   Templates: paste our Uzbek templates. They link to the app's own pages, where the address is confirmed
   only when the person presses a button (mail scanners cannot use up the link, other devices work):
   - **Confirm signup** — subject `Davra: emailingizni tasdiqlang`, body `supabase/templates/confirmation.html`
   - **Reset password** — subject `Davra: parolni tiklash`, body `supabase/templates/recovery.html`

   Until then the default English emails work too, as long as the link is opened in the browser that
   signed up or asked for the reset (on another device, the address is still confirmed; the person signs in).

7. Apply the schema. This creates the tables, policies, triggers, the starting topics, the URL-shortener
   blocklist, the `avatars` bucket and the daily popularity job (pg_cron).
   - **Automatically (recommended):** the `Supabase migrations` GitHub Action
     (`.github/workflows/supabase-migrations.yml`) runs `supabase db push` whenever migrations reach
     `main`. Add three repository secrets under GitHub → Settings → Secrets and variables → Actions:
     `SUPABASE_ACCESS_TOKEN` (https://supabase.com/dashboard/account/tokens), `SUPABASE_DB_PASSWORD`
     (the database password chosen when creating the project) and `SUPABASE_PROJECT_ID` (Project
     Settings → General). To re-run it, open Actions → Supabase migrations → Run workflow.
   - **By hand:**
     ```bash
     pnpm supabase login
     pnpm supabase link --project-ref <project-ref>
     pnpm supabase db push
     ```
8. Make the first admin: sign up in the app, then run in the SQL editor (Dashboard → SQL Editor, or
   Studio locally):
   ```sql
   update public.profiles set role = 'admin' where username = '<your-username>';
   ```

## Link checker

Published links are checked about once a week (DECISIONS.md D56–D58). Vercel Cron calls
`/api/cron/link-check` every day at 21:00 UTC (02:00 in Tashkent, `vercel.json`); each run checks the
links whose last check is more than 7 days old, oldest first, for up to 40 seconds. Two failed checks in a
row mark a link broken: the card gets a warning and leaves the "Mashhur" feed. Staff see broken and
reported links under **Moderatsiya → Havolalar**, where they can check a link again at once.

To turn it on, add `CRON_SECRET` in Vercel → Project → Settings → Environment Variables (Production), a
random value of at least 16 characters, e.g. the output of `openssl rand -hex 32`, mark it sensitive and
redeploy. Vercel sends it with every cron call; without it the route refuses every call (the build log
warns). Cron jobs run on production deployments only. To try it locally, put a `CRON_SECRET` in
`.env.local` and call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/link-check
```

## Scripts

| Command                             | What it does                                    |
| ----------------------------------- | ----------------------------------------------- |
| `pnpm dev`                          | Start the dev server                            |
| `pnpm build` / `pnpm start`         | Production build / serve                        |
| `pnpm lint`                         | ESLint                                          |
| `pnpm typecheck`                    | Generate route types and run `tsc`              |
| `pnpm format` / `pnpm format:check` | Prettier                                        |
| `pnpm test`                         | Unit tests (Vitest)                             |
| `pnpm check`                        | Lint + typecheck + format check + tests         |
| `pnpm db:start` / `pnpm db:stop`    | Start / stop local Supabase                     |
| `pnpm db:status`                    | Show local URLs and keys                        |
| `pnpm db:reset`                     | Recreate the local DB from migrations and seed  |
| `pnpm db:test`                      | Database tests (pgTAP: RLS, triggers, counters) |
| `pnpm db:types`                     | Regenerate `src/types/database.ts`              |

## Database

Schema, policies and triggers live in `supabase/migrations/` (one file per area: foundation, profiles,
topics, moderation, resources, interactions, audit, jobs, storage, reference data). Design choices are
explained in [DECISIONS.md](DECISIONS.md) (D14–D29). In short:

- **Row Level Security on every table.** Guests read published content; users write only their own rows;
  moderators and admins moderate; banned users are read-only.
- **Clients never write system fields.** Counters, popularity score, status of a new card, author and
  audit entries are set by the database (column privileges + triggers).
- **Every moderation action is audited** in `audit_log` by triggers, with the acting staff member.
- **Popularity** is recomputed on every like/save/rating and daily by a pg_cron job.

After changing a migration:

```bash
pnpm db:reset   # re-apply all migrations locally
pnpm db:test    # run the pgTAP tests in supabase/tests/database
pnpm db:types   # regenerate the TypeScript types
```

Seeding demo data, end-to-end tests, the link-checker cron and the Vercel deploy guide will be
documented as those phases land.

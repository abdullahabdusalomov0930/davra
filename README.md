# Davra

A focused network where Uzbek students share and discover useful learning resources, each as a
structured card with a short review in Uzbek. Web MVP built with Next.js 16, Supabase and Tailwind CSS.

> The product name lives in `src/lib/site-config.ts`.

Project status: [CHANGELOG.md](CHANGELOG.md). Design choices: [DECISIONS.md](DECISIONS.md).
Full product brief: [claude-code-prompt.md](claude-code-prompt.md) (written under the working name "Resurs").

**Contents:** [Requirements](#requirements) · [Local setup](#local-setup) · [Demo data](#demo-data) ·
[Environment variables](#environment-variables) · [Tests](#tests) · [Importing resources](#importing-resources) ·
[Deploying](#deploying) · [Scheduled jobs](#scheduled-jobs) · [Link checker](#link-checker) ·
[Search engines and sharing](#search-engines-and-sharing) · [Database](#database) · [Scripts](#scripts) ·
[Project structure](#project-structure)

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

# Optional: demo accounts, cards, ratings and comments (see below)
pnpm db:seed

pnpm dev
```

Open http://localhost:3000.

Local service URLs (default ports):

| Service                       | URL                    |
| ----------------------------- | ---------------------- |
| Supabase API                  | http://127.0.0.1:54321 |
| Supabase Studio (DB UI)       | http://127.0.0.1:54323 |
| Mailpit (verification emails) | http://127.0.0.1:54324 |

## Demo data

`pnpm db:seed` fills a **local** database with six accounts, the 36 cards in
`supabase/seed/demo-resources.csv` (real learning sites, Uzbek summaries) and some likes, saves,
ratings, comments, follows, a card waiting for review and an open report, so every page has something
to show. It refuses to run against a non-local Supabase. Start from a clean database with
`pnpm db:reset && pnpm db:seed`.

All demo accounts use the password `davra-demo-parol`:

| Email                   | Username      | Role                                    |
| ----------------------- | ------------- | --------------------------------------- |
| `admin@example.com`     | `davra_admin` | admin                                   |
| `moderator@example.com` | `dilnoza`     | moderator                               |
| `nodira@example.com`    | `nodira`      | member (trusted: cards publish at once) |
| `jasur@example.com`     | `jasur`       | member (trusted)                        |
| `malika@example.com`    | `malika`      | member (trusted)                        |
| `yangi@example.com`     | `yangi_azo`   | new member (cards wait for a moderator) |

## Environment variables

| Variable                               | Where           | Purpose                                                   |
| -------------------------------------- | --------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | public          | Canonical site URL, used for SEO and auth redirects       |
| `NEXT_PUBLIC_SUPABASE_URL`             | public          | Supabase project URL                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public          | Supabase publishable key (RLS applies)                    |
| `SUPABASE_SECRET_KEY`                  | **server only** | Supabase secret key; bypasses RLS. Never expose or commit |
| `CRON_SECRET`                          | **server only** | Token for the scheduled link check; optional              |
| `NEXT_PUBLIC_CONTACT_EMAIL`            | public          | Contact address on the legal pages; optional              |

`pnpm build` first runs `scripts/check-env.ts`: a missing or malformed variable fails the build with its
name (never its value) instead of deploying a site that answers every request with "Internal Server Error".
URLs must include `https://`. On Vercel, mark `SUPABASE_SECRET_KEY` and `CRON_SECRET` as sensitive;
`NEXT_PUBLIC_*` values are compiled into the browser bundle anyway. After changing a variable, redeploy.

## Tests

| Command         | What it checks                                                                        | Needs           |
| --------------- | ------------------------------------------------------------------------------------- | --------------- |
| `pnpm test`     | Unit tests (Vitest): validators, URL normalization, search, link checker, CSV import… | nothing         |
| `pnpm db:test`  | Database tests (pgTAP): RLS, triggers, counters, limits, search, weekly top           | `pnpm db:start` |
| `pnpm test:e2e` | End-to-end flows and accessibility (Playwright + axe-core), desktop and phone         | `pnpm db:start` |
| `pnpm check`    | Lint, typecheck, format and unit tests: run before every commit                       | nothing         |

`pnpm test:e2e` **resets the local database** and loads the demo data before running, then starts
`pnpm dev` unless something already serves http://localhost:3000. The first time, install the browser:
`pnpm exec playwright install chromium`. The suite covers guests (feed, search with Cyrillic and filters,
topics, weekly top, keyboard skip link, 404), members (sharing, duplicates, likes, saves, ratings,
comments, follows), moderation (pending queue, reports, 404 for non-staff), phone layouts, and runs
axe-core's WCAG 2.1 AA checks on every public, member and admin page in light and dark mode.

Lighthouse (mobile, production build, local data) on the public pages: Performance 88–96,
Accessibility 100, Best Practices 93–100, SEO 100.

## Importing resources

For a cold start, an admin can import cards from a CSV file. Rows become published cards shared by a
moderator or admin account:

```bash
pnpm import:resources resources.csv --author <username> --dry-run   # check only
pnpm import:resources resources.csv --author <username>
```

The script uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` from `.env.local` and prints the host
it writes to. To import into the cloud project, put its values in `.env.local` temporarily, or run the
command with them set in your shell.

| Column          | Required | Values                                                                      |
| --------------- | -------- | --------------------------------------------------------------------------- |
| `title`         | yes      | 3–120 characters, not all capitals                                          |
| `url`           | yes      | http(s) link; normalized like the form (tracking parameters removed)        |
| `topic`         | yes      | a topic slug, e.g. `dasturlash`, `matematika`, `ielts`                      |
| `type`          | yes      | `course`, `video`, `channel`, `book`, `website`, `tool`, `article`, `other` |
| `language`      | yes      | `uz`, `ru`, `en`, `other`                                                   |
| `price`         | yes      | `free`, `freemium`, `paid`                                                  |
| `level`         | yes      | `beginner`, `intermediate`, `advanced`, `all`                               |
| `summary`       | yes      | 40–500 characters, in your own words                                        |
| `for_whom`      | yes      | 10–200 characters                                                           |
| `author_review` | no       | up to 600 characters                                                        |

UTF-8, comma-separated, with a header row (Excel's "CSV UTF-8" works). Every row is checked with the same
rules as the "Resurs qoʻshish" form, and nothing is written if any row is invalid; the errors are listed
by row. Links already on Davra are skipped, so the same file can be imported again safely.
`supabase/seed/demo-resources.csv` is a complete example (its extra `shared_by` column is ignored).

## Deploying

### 1. Supabase (database, auth, storage)

1. Create a project at https://supabase.com (pick the region closest to your users and Vercel functions;
   we use Central EU, Frankfurt). Security options: keep **Enable Data API** and **Automatically expose new
   tables** on — the migrations revoke and re-grant access table by table, and the server's secret key
   relies on the default grants. **Enable automatic RLS** can stay off: every migration enables RLS itself.
2. Project Settings → API Keys: copy the URL, the publishable key and a secret key (you will paste them
   into Vercel).
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
   blocklist, the `avatars` bucket and the pg_cron jobs.
   - **Automatically (recommended):** the `Supabase migrations` GitHub Action
     (`.github/workflows/supabase-migrations.yml`) runs `supabase db push` whenever migrations reach
     `main`. Add three repository secrets under GitHub → Settings → Secrets and variables → Actions:
     `SUPABASE_ACCESS_TOKEN` (https://supabase.com/dashboard/account/tokens), `SUPABASE_DB_PASSWORD`
     (the database password chosen when creating the project) and `SUPABASE_PROJECT_ID` (Project
     Settings → General). To apply a pull request's migrations before merging it (so its preview
     works), open Actions → Supabase migrations → Run workflow and pick the pull request's branch.
   - **By hand:**
     ```bash
     pnpm supabase login
     pnpm supabase link --project-ref <project-ref>
     pnpm supabase db push
     ```

### 2. Vercel (the app)

1. https://vercel.com → Add New → Project → import this GitHub repository. Framework preset: Next.js;
   the defaults for build command, output and install command are right (pnpm is detected from
   `packageManager`).
2. Settings → Environment Variables: add every variable from the table above for **Production and
   Preview** (Preview deployments run the same build check). `NEXT_PUBLIC_SITE_URL` is the production
   address without a trailing slash, e.g. `https://davra.uz`. Mark `SUPABASE_SECRET_KEY` and
   `CRON_SECRET` as sensitive.
3. Deploy. Every push to a branch gets a preview deployment; `main` deploys to production.
4. Settings → Domains: add your domain, then update `NEXT_PUBLIC_SITE_URL` and Supabase's Site URL and
   Redirect URLs to it, and redeploy.
5. Settings → Cron Jobs should list `/api/cron/link-check` (from `vercel.json`). Press **Run** once and check
   the function log for "Link check finished".

### 3. After the first deploy

1. Make the first admin: sign up in the app, then run in Supabase's SQL editor:
   ```sql
   update public.profiles set role = 'admin' where username = '<your-username>';
   ```
   Admins promote moderators from **Moderatsiya → Foydalanuvchilar**.
2. Optional cold start: import a first set of cards with `pnpm import:resources` (see above).
3. Submit `https://<domain>/sitemap.xml` to Google Search Console and Yandex Webmaster.
4. Have a lawyer review the draft legal pages (and where personal data may be stored, DECISIONS.md D61)
   before inviting students.

## Scheduled jobs

| Job                         | Where                                         | When (UTC)  | What it does                                           |
| --------------------------- | --------------------------------------------- | ----------- | ------------------------------------------------------ |
| `/api/cron/link-check`      | Vercel Cron (`vercel.json`)                   | daily 21:00 | Checks the links that are due (each about once a week) |
| `refresh-popularity-scores` | pg_cron (`…_jobs.sql`)                        | daily 21:00 | Recomputes the time-decayed "Mashhur" scores           |
| `prune-rate-events`         | pg_cron (`…_limits_and_removal_requests.sql`) | daily 22:30 | Deletes rate-limit events older than two days          |

21:00 UTC is 02:00 in Tashkent. pg_cron jobs are created by the migrations and run inside the database
(Supabase → Integrations → Cron shows their runs). Vercel Cron runs on production deployments only; the
Hobby plan allows one run a day per job.

## Link checker

Published links are checked about once a week (DECISIONS.md D56–D58). Each daily run checks the links whose
last check is more than 7 days old, oldest first, for up to 40 seconds. Two failed checks in a row mark a
link broken: the card gets a warning and leaves the "Mashhur" feed. 401/403/429 answers count as
"unknown", not broken. Staff see broken and reported links under **Moderatsiya → Havolalar**, where they
can check a link again at once.

To turn it on, add `CRON_SECRET` in Vercel → Project → Settings → Environment Variables (Production), a
random value of at least 16 characters, e.g. the output of `openssl rand -hex 32`, mark it sensitive and
redeploy. Vercel sends it with every cron call; without it the route refuses every call (the build log
warns). To try it locally, put a `CRON_SECRET` in `.env.local` and call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/link-check
```

## Search engines and sharing

Nothing to set up beyond `NEXT_PUBLIC_SITE_URL`, which must be the final public address: canonical
URLs, `sitemap.xml`, `robots.txt`, structured data and share images are all built from it. Preview
deployments tell crawlers to stay away.

- Share images (Telegram, X, …) are drawn per resource by `src/app/resurs/[slug]/opengraph-image.tsx`
  with the Inter fonts in `src/assets/fonts` (Latin with oʻ/gʻ, and Cyrillic).
- The web manifest makes "Add to home screen" work; its icons, the favicon and the Apple touch icon come
  from `pnpm icons`.
- The legal pages (`/qoidalar`, `/shartlar`, `/maxfiylik`) are drafts marked as such until a lawyer has
  reviewed them; their text is in `messages/uz.json` under `Legal`.

## Database

Schema, policies and triggers live in `supabase/migrations/` (one file per area). Design choices are
explained in [DECISIONS.md](DECISIONS.md). In short:

- **Row Level Security on every table.** Guests read published content; users write only their own rows;
  moderators and admins moderate; banned users are read-only. The pgTAP tests prove it.
- **Clients never write system fields.** Counters, popularity score, status of a new card, author and
  audit entries are set by the database (column privileges + triggers).
- **Every moderation action is audited** in `audit_log` by triggers, with the acting staff member.
- **Limits live in the database**: new cards, comments, likes, saves and reports per user and time window.

After changing the schema, add a new migration (never edit an applied one), then:

```bash
pnpm db:reset   # re-apply all migrations locally
pnpm db:test    # run the pgTAP tests in supabase/tests/database
pnpm db:types   # regenerate the TypeScript types
```

## Scripts

| Command                              | What it does                                     |
| ------------------------------------ | ------------------------------------------------ |
| `pnpm dev`                           | Start the dev server                             |
| `pnpm build` / `pnpm start`          | Production build / serve                         |
| `pnpm lint`                          | ESLint                                           |
| `pnpm typecheck`                     | Generate route types and run `tsc`               |
| `pnpm format` / `pnpm format:check`  | Prettier                                         |
| `pnpm test`                          | Unit tests (Vitest)                              |
| `pnpm test:e2e`                      | Reset + seed the local DB, then Playwright tests |
| `pnpm check`                         | Lint + typecheck + format check + unit tests     |
| `pnpm db:start` / `pnpm db:stop`     | Start / stop local Supabase                      |
| `pnpm db:status`                     | Show local URLs and keys                         |
| `pnpm db:reset`                      | Recreate the local DB from the migrations        |
| `pnpm db:seed`                       | Load the demo data into the local DB             |
| `pnpm db:test`                       | Database tests (pgTAP)                           |
| `pnpm db:types`                      | Regenerate `src/types/database.ts`               |
| `pnpm import:resources <file.csv> …` | Import cards from CSV (see above)                |
| `pnpm icons`                         | Regenerate the app icons from `src/lib/brand.ts` |

## Project structure

```
messages/uz.json          every UI string (Uzbek); structure ready for ru.json
src/app/                  routes (App Router); admin/, api/cron/, legal pages, share images, sitemap
src/components/           UI by feature (resources, feed, admin, legal, …) and ui/ primitives
src/lib/                  shared code: validators (Zod), routes, URL normalization, transliteration, SEO
src/server/               server-only code: auth/session, actions, services, link checker, share images
supabase/migrations/      schema, RLS, triggers, jobs        supabase/tests/database/   pgTAP tests
supabase/seed/            demo cards (CSV)                    scripts/                   seed, import, icons
tests/unit/               Vitest                              tests/e2e/                 Playwright + axe
```

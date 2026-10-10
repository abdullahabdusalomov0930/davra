# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Phase 3 — Auth, profiles, settings

#### Added

- Sign-up (`/royxatdan-otish`), sign-in (`/kirish`), email confirmation (`/email-tasdiqlash`), password
  reset (`/parolni-tiklash`, `/parolni-tiklash/yangi`) with Uzbek messages for every Supabase Auth error,
  resend with a cooldown, password visibility toggle, and safe `?next=` redirects.
- Uzbek email templates (`supabase/templates/`) with `token_hash` links that are confirmed by a button.
- Public profile `/u/[username]`: avatar, name, role badge, bio, university, field of study, join date.
- Settings `/sozlamalar`: avatar upload (cropped and re-encoded in the browser, checked by magic bytes on
  the server) and removal, profile form, sign-out.
- Signed-in header: account menu with profile, settings and sign-out.
- Proxy redirects for protected pages, sign-in/sign-up when signed in, and lower-case profile URLs.
- Reserved usernames enforced in the database (migration) and the forms.
- UI primitives: input, textarea, label, avatar, alert, badge, dropdown menu; form helpers (`Field`,
  `PasswordInput`, `SubmitButton`).
- Unit tests for validators, redirects, auth errors, image checks and routes (56 in total); pgTAP checks
  for reserved usernames (154 in total).

#### Changed

- Local Supabase: minimum password length 8, custom email templates.

### Deployment

#### Added

- `pnpm build` checks environment variables first (`scripts/check-env.ts`) and fails with the variable's
  name instead of deploying a site that returns "Internal Server Error". Supabase/site URLs must be http(s)
  and are trimmed.
- `Supabase migrations` GitHub Action: applies new migrations to the production Supabase project when
  they reach `main`.

### Phase 2 — Database

#### Added

- Migrations in `supabase/migrations/`: enums; `profiles`, `topics`, `resources`, `resource_likes`,
  `resource_saves`, `resource_ratings`, `comments`, `follows_users`, `follows_topics`, `reports`,
  `audit_log`, `blocked_domains`; constraints from the brief (lengths, enums, unique normalized URL,
  one rating per user, no self-follow) and indexes for feeds, search and moderation queues.
- Row Level Security on every table, column-level privileges and guard triggers: guests read only,
  users write only their own rows, moderators/admins moderate, banned users are read-only.
- Triggers: profile creation on sign-up, trust-based `pending`/`published` status, URL change re-check,
  denormalized counters, popularity score, report handling, audit log of every moderation action.
- Popularity score function (documented in `private.popularity_score`) and a daily pg_cron refresh.
- Full-text `search_vector` (config `simple`, apostrophe-insensitive) and a trigram index on titles.
- Reference data: the 12 starting topics and a blocklist of URL shorteners.
- Public `avatars` Storage bucket (JPEG/PNG/WebP, 1 MiB) with per-user folder policies.
- Generated database types in `src/types/database.ts`, used by all Supabase clients.
- pgTAP tests (152 checks) in `supabase/tests/database/`; scripts `pnpm db:test` and `pnpm db:types`.

### Phase 1 — Project setup

#### Added

- Next.js 16.4 (App Router, TypeScript strict), Tailwind CSS 4, shadcn/ui (Radix).
- `next-intl` with Uzbek messages in `messages/uz.json` and type-checked message keys.
- Supabase clients for the browser, the server and the proxy, and a server-only admin client.
- `src/proxy.ts`: per-request CSP nonce and Supabase session refresh; security headers in `next.config.ts`.
- Base layout: sticky header with navigation, mobile menu, dark mode toggle, footer with legal links,
  skip link, 404 page, error boundaries, loading skeleton, empty state.
- Landing page hero and the three value points.
- Local Supabase config (`supabase/config.toml`) with email confirmation enabled.
- Tooling: ESLint (+ Prettier), Prettier with the Tailwind plugin, Vitest with first unit tests (CSP, env).
- `.env.example`, `DECISIONS.md`, `README.md`.

#### Changed

- Product renamed from the working name "Resurs" to **Davra**.

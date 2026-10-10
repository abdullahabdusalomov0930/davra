# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Phase 6 — Likes, saves, ratings, comments, follows

#### Added

- Like and save on every card and on the resource page, applied at once and rolled back with a message
  if the server refuses. Guests are sent to sign in (and back); authors see the count only.
- `/saqlanganlar`: saved resources, most recently saved first, with a topic filter and "load more".
- Ratings: 1–5 stars with an optional review (500 characters), edit and delete (with confirmation),
  the average on cards and pages, and written reviews on the resource page. Ratings from accounts
  younger than 24 hours are shown but not counted yet, and the form says so.
- Comments: flat, oldest first, 500 characters, deletable by their author with confirmation; hidden
  comments stay visible to their author with a note.
- Follow people (profile and resource pages) and topics (topic pages).
- **Obunalarim** (`/obunalarim`, also a home tab for members): the newest resources from followed people
  and topics, with the followed topics and people listed above.
- Account menu: Saqlanganlar and Obunalarim.
- Migration `20261010180000_following_feed.sql`: `search_resources(following_only)`.
- Tests: 8 pgTAP checks for the following feed (193 in total), unit tests for the rating and comment
  validators (113 in total).

### Phase 5 — Feed, topics, search

#### Added

- Home feed with **Mashhur** (default, time-decayed popularity, broken links left out) and **Yangi** tabs.
  Guests see the value points above it; signed-in users go straight to the feed.
- Topics: `/mavzular` (all topics with their number of published resources) and `/mavzu/[slug]` with
  **Eng yaxshilari** (top rated) and **Yangi** tabs and a link to search within the topic.
- Search `/qidiruv`: query box, filters (topic, type, language, price, level), sort (best match, newest,
  top rated), all kept in the URL with Uzbek parameter names (`q`, `mavzu`, `tur`, `til`, `narx`,
  `daraja`, `tartib`). Invalid values in a shared link are ignored.
- Search matching: every word must match, as a full-text prefix (title, summary, for whom; apostrophe-
  and case-insensitive) or fuzzily in the title (trigram), so typos like "pyton" still work. Cyrillic
  queries also search their Latin spelling.
- "Yana koʻrsatish" pagination with keyset cursors; the button is a real link, so it also works without
  JavaScript. Cards are always rendered on the server.
- Related resources from the same topic on the resource page.
- Migration `20261010170000_search.sql`: `rating_score` (average rating pulled towards 3 by two virtual
  ratings) with indexes, `private.prefix_tsquery`, and `public.search_resources`, the single read path
  for every list.
- Loading skeletons for search and topic pages.
- Tests: 31 pgTAP checks for search (185 in total) and unit tests for cursors, search parameters and
  transliteration (107 in total).

### Phase 4 — Resource cards

#### Added

- Share a resource at `/yangi-resurs`: link, title, topic, type, language, price, level, "what it teaches",
  "who it is for" and an optional personal review, with live character counters and Uzbek messages.
- Resource page `/resurs/[slug]`: all fields, "Havolaga oʻtish" (new tab, `rel="nofollow ugc noopener
noreferrer"`), domain with favicon, rating summary, author, date; banners for pending, hidden, rejected
  cards and broken links; edit and delete (with confirmation) for the author.
- Edit page `/resurs/[slug]/tahrirlash` (author only). Text edits keep the card published; a new link sends
  a non-trusted author's card back to review (database trigger).
- URL normalization (`src/lib/url-normalize.ts`): https for bare domains, lower-case host, no fragment, no
  tracking parameters (`utm_*`, `fbclid`, `gclid`, …), one form for YouTube links; IPs, intranet hosts and
  credentials are refused. The form shows the cleaned link when the field loses focus.
- Duplicate detection: the database's unique URL plus a friendly check against the same page with or
  without `www.`, `http`/`https` and a trailing slash, pointing the author to the existing card.
- Spam rules in the shared Zod schema: no ALL-CAPS titles, emoji limits, summaries that are more than a link.
- Slugs transliterated from the title (Uzbek Latin and Cyrillic, `oʻ`/`gʻ` → `o`/`g`), stable after edits,
  with a short suffix when taken.
- Resource card component (type icon, title, domain and favicon, topic chip, tags, summary, rating, author,
  relative date) and the author's cards on `/u/[username]` (the owner also sees pending ones).
- "Resurs qoʻshish" button in the header; UI primitives: alert dialog, native select, radio chips.
- Unit tests for URL normalization, slugs and the resource schema (94 in total).

#### Changed

- CSP `img-src` allows `https://icons.duckduckgo.com` for favicons.

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

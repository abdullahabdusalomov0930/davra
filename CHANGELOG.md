# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Security addendum X2–X5 — Trust, reports, moderation, link and app security

#### Added

- Trust levels 0–3 on every profile, kept current automatically; admins can set them by hand.
- Reports with new reasons (severe, illegal, piracy, scam, harassment), weighted by the reporter's
  trust and track record; content is hidden automatically at weight 3 (2 for illegal content or
  scams) and goes to the top of the queue.
- Severe content: hidden at the first report, a frozen copy kept as evidence for admins
  (/admin/jiddiy), no deletion before the evidence is marked preserved.
- In-app notifications (/bildirishnomalar) for hidden, rejected or restored content, bans, warnings
  and appeal decisions; one appeal per decision; the ban notice on every page for banned users.
- Moderator tools: every action asks for a reason (shown to the user, kept in the audit log),
  temporary bans (1, 7, 30 days), warnings, trust levels, permanent bans and deletions confirmed by an
  admin (/admin/sorovlar), appeals (/admin/etirozlar), audit log (/admin/jurnal), settings and extra
  words for the word filter (/admin/sozlamalar). Queue items show the final link, its reputation and
  the author's trust level and history.
- "Siz tashqi saytga oʻtyapsiz" page before links to domains new to Davra; the weekly link check also
  re-checks link reputation and hides newly flagged links.
- Account data: JSON export and account deletion in /sozlamalar.
- Optional Cloudflare Turnstile on sign-up and new members' cards; optional fresh sign-in for admin
  actions (REQUIRE_RECENT_LOGIN_FOR_ADMIN).
- Rate limits by IP and e-mail for sign-in, sign-up, password reset and confirmation e-mails, 60
  searches a minute per address, new links per address; suspicious sign-in activity for admins
  (/admin/xavfsizlik).
- CI (lint, types, format, tests, audit, build, gitleaks), Dependabot, `pnpm secrets:scan` with a
  pre-commit hook (`pnpm hooks:install`), `pnpm security:smoke` for security headers.
- SECURITY.md, docs/MODERATION_GUIDE.md, docs/INCIDENT_RESPONSE.md, a pre-launch security checklist
  in the README.

#### Changed

- Sign-in, sign-up and password reset run on the server; session cookies are HttpOnly; the browser no
  longer talks to Supabase (CSP connect-src 'self').
- Passwords need at least 10 characters and may not be common or contain your username.
- One published card now makes a member level 1 (cards publish at once if the check allows them).
- /qoidalar lists what is not allowed, with examples and a link target for every rule; the privacy
  policy describes the new data (auth events, hashed IPs kept 30 days, export and deletion).
- Server inputs reject unknown fields.

#### Owner to do

- Supabase Dashboard → Authentication → Providers → Email: minimum password length 10.
- Optional: Turnstile keys and REQUIRE_RECENT_LOGIN_FOR_ADMIN on Vercel; GitHub → Settings → Code
  security: enable Dependabot alerts and private vulnerability reporting.
- Work through the security checklist in the README before launch.

#### Results

- Tests: 285 unit, 319 pgTAP, 45 end-to-end; security smoke 16/16 against a production build.

### Security addendum X1 — Content safety core

#### Added

- Safety check on every card, comment, review and profile (`src/server/safety/`): link policy, text
  policy with word lists, near-duplicate check and the author's trust level combine into allow, hold for
  a moderator or refuse, with an Uzbek message on the field to change. The database refuses texts that
  did not pass the check (single-use safety tickets), so the Data API cannot be used to skip it.
- Link policy: link shorteners, a category blocklist (adult, gambling, piracy; file hosting is held),
  lookalike domains mixing alphabets and non-standard ports are refused; redirects are followed (at most
  3, SSRF-safe) and where the link really leads is checked too and stored with the card. Optional Google
  Safe Browsing check (`SAFE_BROWSING_API_KEY`).
- Word filter for Uzbek (Latin and Cyrillic), Russian and English that sees through common disguises
  (k.a.z.i.n.o, k4z1n0, mixed alphabets, stylised letters). Starter lists, to be extended by the owner.
- Comments can be held: a new member's comment with a link, a phone number or a doubtful word waits for
  a moderator on the new `/admin/izohlar` page; the author sees it marked as waiting.
- Moderators see why the check held a card or comment; refusals are logged in `moderation_events`
  (staff only, kept 180 days).

#### Changed

- Profile photos removed: avatars are initials on a colour, nothing is uploaded or stored any more.
  Site favicons removed too, so pages load no images from other sites.
- Texts are cleaned before they are checked and stored (invisible characters, repeated letters, extra
  spaces, stylised Unicode).
- The product name is set in `src/lib/config.ts` (`APP_NAME`).

#### Owner to do

- Supabase Dashboard → Storage → avatars → Delete bucket (the migration closes it; files cannot be
  deleted from SQL).
- Optional: set `SAFE_BROWSING_API_KEY` on Vercel (README, Environment variables).
- Extend the word lists and domain lists in `src/server/safety/data/`.

#### Results

- Tests: 234 unit, 263 pgTAP, 42 end-to-end.

### Phase 10 — Demo data, tests, accessibility and performance

#### Added

- `pnpm import:resources <file.csv> --author <username>`: bulk import for a cold start (brief 6.1).
  Rows are checked with the web form's rules first (nothing is written if any row is invalid, errors
  listed by row), links already on Davra are skipped so a file can be imported again, and cards are
  shared in a moderator's or admin's name. `--dry-run` only checks.
- `pnpm db:seed`: six demo accounts, 36 cards of real learning sites with Uzbek summaries
  (`supabase/seed/demo-resources.csv`), likes, saves, ratings, comments, follows, a pending card and a
  report. Local databases only.
- End-to-end suite (`pnpm test:e2e`, Playwright): guest, member and moderation flows, phone layouts,
  and axe-core WCAG 2.1 AA checks on every public, member and admin page in light and dark mode.
- README rewritten as a setup and deploy guide: demo data, tests, CSV import, Supabase and Vercel
  setup step by step, scheduled jobs, project structure.

#### Changed

- No page-wide loading skeleton any more: pages arrive complete, so nothing jumps when content replaces
  the skeleton (layout shift was 0.17 on several pages), the largest paint comes earlier, missing pages
  answer with a real 404, and metadata is in `<head>` for every client.
- Only the Latin subset of Inter is preloaded (it covers oʻ/gʻ); Cyrillic and Latin Extended load
  only on pages that use them.
- Zod no longer probes for `eval` in the browser (it tripped the Content-Security-Policy); all imports
  go through `src/lib/zod.ts`, enforced by ESLint.
- Topic and weekly pages have a list heading for screen readers, so the heading outline has no gaps.

#### Results

- Lighthouse (mobile, production build) on public pages: Performance 88–96 (was 71–90),
  Accessibility 100, SEO 100, layout shift 0.
- Tests: 156 unit, 233 pgTAP, 38 end-to-end.

### Phase 9 — SEO, sharing, legal pages, weekly top

#### Added

- Metadata on public pages: canonical URLs, OpenGraph and Twitter tags (articles for resources,
  profiles for people), and JSON-LD: `WebSite` with a search action on the home page,
  `LearningResource` with rating and breadcrumbs on resource pages, `ProfilePage`, topic breadcrumbs.
- Share images: a site-wide one and one per resource (topic, title, site, type, language, rating),
  drawn with bundled Inter fonts so oʻ/gʻ and Cyrillic titles render correctly.
- `sitemap.xml` (static pages, topics, published resources, authors' profiles; built per request from
  what guests can see) and `robots.txt` (private and admin paths closed; previews closed entirely).
- Web app manifest and a Davra icon set (favicon, SVG icon, Apple touch icon, maskable icon) generated
  by `pnpm icons` from one logo definition.
- Legal pages `/qoidalar`, `/shartlar`, `/maxfiylik` in Uzbek, marked as drafts for a lawyer's review,
  with an optional contact address (`NEXT_PUBLIC_CONTACT_EMAIL`).
- `/haftalik`: the 10 resources with the most likes, saves and good ratings in the last 7 days, with
  each one's activity this week.
- Migration `20261010210000_weekly_top.sql`: `weekly_top_resources` and `created_at` indexes.
- Tests: 9 pgTAP checks (233 in total); unit tests for descriptions, the contact setting and the legal
  texts (146 in total).

### Phase 8 — Link checker

#### Added

- Scheduled link check: Vercel Cron calls `/api/cron/link-check` daily (protected by `CRON_SECRET`);
  every published link is checked about once a week, oldest check first. HEAD first, GET if HEAD gives
  no clear answer, up to 5 redirects, time limits, an honest `DavraLinkChecker` user agent, six sites at
  a time and one request at a time per site.
- Two failed checks in a row mark a link broken; a working answer resets it. 401/403/429, bot
  challenges and certificate problems on our side count as "unknown" and change nothing.
- SSRF protection: only http(s); every address a host resolves to (and every redirect target) must be a
  public IP, and the connection goes to exactly the checked address.
- "Havola ishlamayapti" button on resource pages (signed-in members, one report per resource) and a
  warning badge on cards with broken links (they already left the "Mashhur" feed).
- **Havolalar** page in `/admin`: reported links grouped per resource and links the checker marked
  broken, with the last check time and failure count; "Hozir tekshirish" runs the checker at once,
  "Ishlamayapti" / "Ishlayapti" decide and close the link's reports.
- Migration `20261010200000_link_checker.sql`: `record_link_check` (service role only) and an index
  for picking due links.
- Tests: 11 pgTAP checks (224 in total), unit tests for the address filter, the checker (against a
  local HTTP server) and the scheduler (138 in total).

#### Fixed

- Cards with long unbreakable content no longer stretch past their grid column.

### Phase 7 — Reports, moderation, rate limits

#### Added

- Report button on resources, comments and profiles: reason (spam, wrong info, inappropriate, copyright,
  other) and an optional note. One open report per user and target; reporters stay anonymous.
- `/removal-request`: public form for copyright holders and others (no account), limited per IP address,
  with a honeypot against bots.
- Moderation panel `/admin` for moderators and admins (others get a 404):
  - overview with queue counts and the latest audit log entries;
  - **Resurslar**: pending, hidden and rejected cards; approve, reject, hide, restore;
  - **Shikoyatlar**: open reports (take the content down, resolve, dismiss) and removal requests;
  - **Havolalar**: cards with broken links and broken-link reports (completed in Phase 8);
  - **Foydalanuvchilar**: search, ban/unban, roles (admins);
  - **Mavzular** and **Domenlar**: topics and the domain blocklist (admins).
- Staff see a moderation toolbar on resource pages and can hide comments in place; "Moderatsiya" in the
  account menu.
- Rate limits in the database: 3 new resources a day (10 for trusted authors), 30 comments a day, 100
  likes and saves an hour, 20 reports a day, with clear messages in the forms.
- Migration `20261010190000_limits_and_removal_requests.sql`: rate-limit events and triggers, a daily
  cleanup job, the `removal_requests` table and its audit logging.
- Tests: 20 pgTAP checks (213 in total), unit tests for the moderation validators (121 in total).

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

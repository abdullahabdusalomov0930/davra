# PROJECT BRIEF: "Resurs" — Uzbek-language learning resources network for students (Web MVP)

> Working name: **Resurs** (placeholder, easy to rename via a single config constant).

You are a senior full-stack engineer. Build the web MVP described below from scratch, step by step. Before writing any code, read this whole brief, then reply with a short implementation plan (phases, folder structure, open questions). Wait for my "go" only if you have blocking questions; otherwise proceed phase by phase.

---

## 1. Product vision

A focused social network where students share and discover **useful learning resources** (Khan Academy, Schoolhouse.world, Coursera, YouTube channels, books, websites, tools, etc.) with **short Uzbek-language reviews**. It is NOT a general social network. Every post is a structured "resource card", not free-form chatter.

Core loop: **discover resource → save it / follow topics and people → share your own resource → get recognition.**

### Why users come here instead of Telegram/Instagram/YouTube
- Searchable and filterable (topic, level, language, price) — Telegram channels are not.
- Structured cards with rating and "who is this for" — not scattered messages.
- Quality control (moderation, reporting, dead-link detection).
- Personal saved lists and topic/person following.

### Target users
University students in Uzbekistan (first users come from my university). UI language: **Uzbek (Latin script)** by default. Russian will be added later, so the code must be i18n-ready from day one (see 6.9).

---

## 2. Scope

### IN scope (MVP, build all of this)
1. Auth: sign up, log in, log out, email verification, password reset.
2. User profile: display name, username (unique, slug), avatar, short bio, university, field of study, public profile page.
3. Resource cards (the only post type): create, edit, delete own, view.
4. Feed: tabs **Yangi** (newest), **Mashhur** (popular, time-decayed), **Obunalarim** (from people/topics I follow; requires login).
5. Follow / unfollow **users** and **topics**.
6. Like (upvote) and **save** (personal bookmarks) a resource.
7. Rating (1–5) with one rating per user per resource, plus a short review text (optional).
8. Comments (flat, no nesting) on a resource.
9. Topics (categories), topic pages, search with filters.
10. Report button (resource, comment, user) + admin moderation panel.
11. Dead-link reporting and automatic periodic link check.
12. Roles: guest, user, moderator, admin.
13. SEO-friendly public pages (resource, topic, profile), sitemap, robots, OpenGraph.
14. Responsive, mobile-first UI; PWA-ready (manifest + icons) but no offline mode yet.
15. Seed script with realistic Uzbek-language demo data (about 60 resources, 12 topics, 10 users).

### OUT of scope (do NOT build now; do not add placeholders or half-features)
- Coin/reward system, badges, mentorship, chat/DMs, video/file uploads, native mobile app, payments, notifications by email/push, Russian translation content, AI features, recommendation algorithms beyond the simple popularity score.

If you think something out-of-scope is needed, ask me instead of building it.

---

## 3. Tech stack (fixed)

- **Next.js (latest stable, App Router)** + **TypeScript (strict)**
- **Tailwind CSS** + **shadcn/ui** components
- **Supabase**: Postgres, Auth (email/password), Row Level Security, Storage (avatars only)
- **Zod** for validation (shared between client and server)
- **React Hook Form** for forms
- **Vitest** for unit tests, **Playwright** for a few end-to-end smoke tests
- ESLint + Prettier, `pnpm` as the package manager
- Deployment target: Vercel + Supabase cloud. Use environment variables only (no secrets in code); provide `.env.example`.
- Use Server Components and Server Actions/Route Handlers where sensible; keep client JS small.

---

## 4. Resource card (core entity)

| Field | Rules |
|---|---|
| `title` | required, 3–120 chars |
| `url` | required, valid http(s) URL, normalized (strip tracking params like utm_*), must be unique per resource (duplicate detection → show existing card instead) |
| `type` | enum: `course`, `video`, `channel`, `book`, `website`, `tool`, `article`, `other` |
| `topic_id` | required, one primary topic |
| `language` | enum: `uz`, `ru`, `en`, `other` (language of the resource itself) |
| `price` | enum: `free`, `freemium`, `paid` |
| `level` | enum: `beginner`, `intermediate`, `advanced`, `all` |
| `summary` | required, 40–500 chars, "what does it teach", the author's own words |
| `for_whom` | required, 10–200 chars, "who is it good for" |
| `author_review` | optional, up to 600 chars |
| `status` | `pending`, `published`, `hidden`, `rejected` |
| `link_status` | `ok`, `broken`, `unknown` |
| timestamps | `created_at`, `updated_at` |

Rules:
- Only links and the author's own words. No file or video upload. Show the domain and a favicon next to the link.
- A user may edit/delete their own cards. Editing a published card keeps it published unless the URL changes (then re-check).

---

## 5. Database (Supabase Postgres)

Create SQL migrations in `supabase/migrations/`. Tables (use `uuid` PKs, `timestamptz`, sensible indexes and constraints):

- `profiles` (id → auth.users, username unique, display_name, avatar_url, bio, university, field_of_study, role enum [`user`,`moderator`,`admin`], is_banned, created_at)
- `topics` (id, slug unique, name_uz, name_ru nullable, name_en nullable, description_uz, sort_order)
- `resources` (fields from section 4, plus author_id, domain, likes_count, saves_count, comments_count, ratings_count, ratings_sum, popularity_score, last_link_check_at)
- `resource_likes` (user_id, resource_id) PK composite
- `resource_saves` (user_id, resource_id) PK composite
- `resource_ratings` (user_id, resource_id, stars 1–5, review_text nullable) PK composite
- `comments` (id, resource_id, author_id, body 1–500 chars, status, created_at)
- `follows_users` (follower_id, followed_id) PK composite, check follower ≠ followed
- `follows_topics` (user_id, topic_id) PK composite
- `reports` (id, reporter_id, target_type enum [`resource`,`comment`,`user`,`broken_link`], target_id, reason enum + free text, status [`open`,`resolved`,`dismissed`], handled_by, created_at)
- `rate_limits` or equivalent mechanism (see 6.3)

Requirements:
- Denormalized counters maintained by **database triggers** (not by client code).
- `popularity_score` = time-decayed formula (e.g. `(likes + 2*saves + average_rating_weight) / (age_in_hours + 2)^1.5`), recalculated by trigger on interaction and by a scheduled job daily. Document the formula in code.
- **Row Level Security enabled on every table.** Policies: public can read published resources/topics/profiles; users write only their own rows; moderators/admins can moderate; banned users are read-only. Write tests or SQL checks proving RLS works.
- Full-text search: Postgres `tsvector` over title, summary, for_whom (use `simple` configuration, since Uzbek has no built-in dictionary) plus trigram index (`pg_trgm`) for typo-tolerant search.
- Seed file with topics: Dasturlash, Matematika, Ingliz tili, Xitoy tili, IELTS, Iqtisodiyot va moliya, Dizayn, Ma'lumotlar tahlili, Tadbirkorlik, Ilmiy ish yozish, Soft skills, Karyera va stajirovka.

---

## 6. Features in detail (including the "holes" that must be closed)

### 6.1 Cold start (empty platform problem)
- Admin can bulk import resources via a seed script/CSV importer (CLI script in `scripts/`).
- Empty states must be helpful: "Birinchi resursni siz qo'shing", with a call-to-action.
- Landing page for logged-out users must explain the value in 3 points and show the top resources immediately (no login wall for reading).

### 6.2 Spam and low-quality content
- Structured card with required fields and min lengths (above). Reject titles in ALL CAPS, excessive emoji, or summaries that are only the URL.
- New accounts (younger than 3 days or with no approved posts): resources go to `pending` and need moderator approval. Trusted users (3+ approved resources, no confirmed reports) publish instantly.
- Block known URL shorteners and an editable domain blocklist table (`blocked_domains`).
- Duplicate URL detection (normalized).

### 6.3 Rate limiting and abuse
- Limits per user: new users max 3 resources/day, trusted users max 10/day; max 30 comments/day; max 100 likes/saves per hour.
- Limits on auth endpoints and report creation (per IP and per user). Implement in the database or middleware in a simple, testable way.
- One rating per user per resource (DB constraint). Ratings from accounts younger than 24h count at reduced weight or are excluded from the average (document your choice).
- Users cannot like/rate their own resources.

### 6.4 Moderation
- Admin/moderator panel at `/admin`: queues for pending resources, open reports, broken links, user list with ban/unban, blocked domains management, topics management.
- Every moderation action is stored in an `audit_log` table (who, what, when, target).
- Report button on resource, comment, and profile; reasons: spam, wrong info, inappropriate, copyright, other.
- Copyright/removal request form at `/removal-request` (public, goes to admin queue).

### 6.5 Dead links
- Button "Havola ishlamayapti" (login required, one report per user per resource).
- A scheduled job (Supabase cron or a protected route handler called by Vercel Cron) checks links weekly with HEAD then GET fallback, timeouts, a polite User-Agent, and max concurrency; marks `broken` after 2 consecutive failures; broken resources show a warning badge and are hidden from "Mashhur".
- Treat 403/429 as `unknown`, not `broken` (many sites block bots).

### 6.6 Returning users (retention without email/push)
- Personal **"Obunalarim"** feed.
- **Saved** page with custom filter by topic.
- Topic pages with "Eng yaxshilari" (top rated) and "Yangi" tabs.
- Weekly "Top 10" public page (`/haftalik`) generated from the data.

### 6.7 Security
- Passwords handled only by Supabase Auth. No custom password code.
- Validate every input with Zod on the server, even if the client validated it.
- Prevent XSS: never render user text as HTML; escape everything; strict `Content-Security-Policy` headers; `rel="noopener noreferrer ugc nofollow"` on user-submitted links.
- Protect against open redirects, SSRF in the link checker (block private/loopback IP ranges, allow only http/https, limit redirects), and CSRF on mutating routes.
- Never expose the Supabase service-role key to the client. Use it only in server-only modules.
- Add security headers via Next.js config.

### 6.8 Legal pages (Uzbek text, clearly marked as DRAFT to be reviewed by a lawyer)
- `/qoidalar` (community rules), `/shartlar` (terms of use), `/maxfiylik` (privacy policy), `/removal-request`.
- Rule: only links and the user's own words; no pirated content; no file hosting.
- Add a visible cookie/analytics note if analytics are added. Prefer privacy-friendly analytics (Plausible or Umami), optional via env var.

### 6.9 Internationalization
- Use `next-intl` (or equivalent). All UI strings live in `messages/uz.json`; structure for adding `ru.json` later. No hard-coded UI strings in components.
- DB already has `language` on resources and optional `name_ru`/`name_en` on topics.
- Dates/numbers formatted with locale `uz-UZ` (fallback gracefully).

### 6.10 SEO and sharing
- Server-rendered public pages: `/` , `/resurs/[slug]`, `/mavzu/[slug]`, `/u/[username]`, `/haftalik`.
- Dynamic `<title>`, meta description, canonical URL, OpenGraph and Twitter tags, JSON-LD where appropriate, `sitemap.xml`, `robots.txt`.
- Pretty slugs for resources (transliterate Uzbek letters like o‘, g‘, sh, ch properly).

---

## 7. Pages and routes

Public: `/`, `/qidiruv`, `/mavzular`, `/mavzu/[slug]`, `/resurs/[slug]`, `/u/[username]`, `/haftalik`, legal pages.
Auth: `/kirish`, `/royxatdan-otish`, `/parolni-tiklash`, `/email-tasdiqlash`.
Logged-in: `/yangi-resurs`, `/resurs/[slug]/tahrirlash`, `/saqlanganlar`, `/sozlamalar` (profile edit), `/obunalarim`.
Admin: `/admin`, `/admin/resurslar`, `/admin/shikoyatlar`, `/admin/havolalar`, `/admin/foydalanuvchilar`, `/admin/mavzular`, `/admin/domenlar`.

Also build: 404 page, error boundary, loading skeletons, empty states.

---

## 8. UI/UX requirements

- Mobile-first; must look good at 360px width. Test on slow connections (keep pages light; images lazy).
- Clean, calm, education-friendly design: generous whitespace, readable typography (system font stack or a single web font with Cyrillic and Latin Extended support), clear hierarchy, accessible color contrast (WCAG AA), full keyboard navigation, visible focus states.
- Dark mode via CSS variables/Tailwind (follow system preference, with a manual toggle).
- Resource card component: type icon, title, domain + favicon, topic chip, language/price/level tags, short summary, average rating and count, like/save buttons with optimistic UI, author name and avatar, date.
- Resource page: all fields, "Havolaga o'tish" (opens in a new tab), reviews/ratings list, comments, report and broken-link buttons, related resources from the same topic.
- Search page: query box, filters (topic, type, language, price, level), sort (relevance, newest, top rated), URL-synced filters, pagination or infinite scroll with cursor.
- Use toasts for feedback; all destructive actions need confirmation.

---

## 9. Code quality and structure

Suggested structure (adapt if you have a better reason, explain it):

```
/src
  /app            (routes)
  /components     (ui/, resource/, layout/, admin/)
  /lib            (supabase clients, validators, utils, slugify, url-normalize)
  /server         (server-only modules: actions, services, link-checker, rate-limit)
  /messages       (uz.json)
/supabase
  /migrations
  seed.sql
/scripts          (import-csv.ts, seed-demo.ts)
/tests
```

- TypeScript strict, no `any` without a comment explaining why.
- Generate and use Supabase types.
- Business logic in `/server` services, thin route handlers/actions.
- Reusable Zod schemas in `/lib/validators`.
- Write unit tests for: URL normalization, slugify (Uzbek letters), popularity score, rate-limit logic, validators. Write Playwright smoke tests for: sign up → create resource → see in feed → like/save.
- Meaningful commit per phase (Conventional Commits). Keep a `CHANGELOG.md`.

---

## 10. Working method (important)

1. **First reply**: short implementation plan + list of any blocking questions. No code yet.
2. Then work in these phases. After each phase: run lint, type-check, tests, and the app; summarize what was done in 5–8 lines; list anything you could not finish.
   - **Phase 1**: project setup, Tailwind/shadcn, i18n skeleton, Supabase setup instructions, `.env.example`, base layout.
   - **Phase 2**: DB migrations, RLS policies, triggers, seed topics, generated types.
   - **Phase 3**: auth, profiles, settings.
   - **Phase 4**: resource card CRUD, URL normalization, duplicate detection, validation.
   - **Phase 5**: feed, topics, search (full-text + trigram), filters.
   - **Phase 6**: likes, saves, ratings, comments, follows, counters, popularity score.
   - **Phase 7**: reports, admin panel, audit log, rate limits, spam rules, pending queue.
   - **Phase 8**: link checker job, broken-link flow.
   - **Phase 9**: SEO, sitemap, OpenGraph, legal pages, weekly top page, PWA manifest.
   - **Phase 10**: seed demo data, tests, accessibility pass, performance pass, README with setup + deploy guide.
3. Do not skip ahead and do not add features outside section 2. When a requirement is ambiguous, pick the simplest reasonable option, note it in `DECISIONS.md`, and continue (ask only if the choice is expensive to reverse).
4. Never invent facts about external services; if you are unsure about a Supabase/Next.js API, check the official docs in the repo's installed version before coding.
5. Do not commit secrets. Never print or log tokens.

---

## 11. Acceptance criteria (the MVP is done when)

- A new user can sign up, verify email, create a profile, and publish a resource card; a trusted user's card appears in the feed instantly, a new user's card appears after moderator approval.
- Guests can browse the feed, topics, search, resource pages, and profiles without logging in.
- Like, save, rate, comment, follow (users and topics) all work, update counters correctly, and cannot be abused (duplicates, self-like, rate limits).
- Search works with Uzbek text, typos, and filters.
- Reports and broken-link reports reach the admin panel; moderators can resolve them; every action is in the audit log.
- The link checker runs and flags broken links without false-flagging 403/429 sites.
- RLS blocks unauthorized reads/writes (proved by tests or documented SQL checks).
- Lighthouse on mobile: Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 95 on public pages.
- README explains: local setup, Supabase setup, env vars, running tests, seeding, deploying to Vercel, scheduling the cron jobs.
- All UI text is in `messages/uz.json`; no hard-coded strings.

---

## 12. Things I (the owner) will provide or decide later
- Final project name and logo, domain name.
- Supabase project credentials (I will put them in `.env.local` myself).
- Legal text review by a lawyer.
- Real moderator list.

Start now with the **implementation plan** (step 10.1).

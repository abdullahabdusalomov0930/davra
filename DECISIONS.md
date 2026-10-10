# Decisions

Choices made where the brief left room, or where a requirement conflicted with the stack.
Newest at the bottom of each phase.

## Phase 1 — Setup

### D1. Node.js 24 LTS

Vitest 5 and the latest tooling need Node ≥ 22.12, and Node 20 is end-of-life. `.nvmrc` pins 24;
`package.json` declares `engines.node >= 22.12`. Vercel should use Node 24.

### D2. Cache Components / Partial Prerendering are OFF

Next.js 16.4 scaffolds with `cacheComponents: true`. The brief requires a strict CSP; the only
strict option for scripts in Next.js is a per-request **nonce**, which requires every page to be
dynamically rendered and is documented as incompatible with PPR. Almost every page is
user-aware anyway (header session, like/save state). Pages stay light and server-rendered; we
can revisit with SRI-based CSP when it leaves experimental.

### D3. CSP shape

- `script-src 'self' 'nonce-…' 'strict-dynamic'` (plus `'unsafe-eval'` in dev only, required by React dev tooling).
- `style-src 'self' 'unsafe-inline'`: React renders `style` attributes and UI primitives position
  popovers inline; nonces cannot cover style attributes. Style injection is low-risk compared to scripts.
- `img-src` / `connect-src` allow the Supabase origin. New third-party origins (favicons,
  analytics) are added only when the feature that needs them lands.
- Other security headers (HSTS, nosniff, frame DENY, referrer, permissions) live in `next.config.ts`.

### D4. `proxy.ts` instead of `middleware.ts`

Next.js 16 renamed Middleware to Proxy. It generates the nonce and refreshes the Supabase session
(`auth.getClaims()`) on every page request; static assets and link prefetches are skipped.

### D5. i18n without locale-prefixed URLs

Routes are Uzbek words (`/mavzular`, `/kirish`), so `next-intl` runs in "without i18n routing"
mode with a single locale `uz`. Adding Russian = add `"ru"` to `src/i18n/config.ts`, create
`messages/ru.json`, and resolve the locale from a cookie in `src/i18n/request.ts`. Message keys
are type-checked against `messages/uz.json`. Intl formatting uses locale `uz` (Intl resolves it to
`uz-Latn-UZ`) and time zone `Asia/Tashkent`.

### D6. Uzbek apostrophes in UI text

UI strings use the official characters: `ʻ` (U+02BB) in oʻ/gʻ and `ʼ` (U+02BC) for the tutuq belgisi.
Side benefit: ASCII `'` is an escape character in ICU messages, so avoiding it prevents bugs.
User-entered text keeps whatever the user typed; search and slugs will normalize all apostrophe
variants (`' ‘ ’ ʻ ʼ \``) — handled in phases 4–5.

### D7. Supabase API keys

Uses the new key model: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser-safe) and
`SUPABASE_SECRET_KEY` (server-only, read only in `src/server/**`, which imports `server-only`).

### D8. Local development on Docker

`supabase start` runs the full stack locally (Postgres, Auth, Storage, Studio, Mailpit for
verification emails). Realtime, Edge Runtime and Analytics are disabled in `supabase/config.toml`
because the MVP does not use them. Email confirmation is enabled.

### D9. Font

Inter via `next/font` (self-hosted, `display: swap`) with `latin`, `latin-ext` and `cyrillic`
subsets — one web font that covers Uzbek Latin and future Russian.

### D10. Theme

Calm teal primary on cool neutrals, defined as CSS variables (`globals.css`), dark mode via the
`.dark` class with `next-themes` (follows the system until the user toggles). The theme toggle
switches icons with CSS so the server render never mismatches.

### D11. ESLint 9 (not 10)

ESLint 10 is out, but `eslint-plugin-react`, `-jsx-a11y` and `-import` (used by
`eslint-config-next`) don't declare support yet. We stay on 9 so the accessibility rules run reliably.

### D12. shadcn/ui on Radix

`radix-nova` style. Generated components are edited when they contain hard-coded English
(e.g. `Sheet` now requires a translated `closeLabel`).

### D13. Product name: Davra

The owner chose **Davra** (matches the GitHub repo name) instead of the working name "Resurs".
Changed in `src/lib/site-config.ts`, `package.json` and the local Supabase `project_id`.
The brief (`claude-code-prompt.md`) still says "Resurs"; treat that as the old working name.

## Phase 2 — Database

### D14. Security model: RLS + column privileges + guard triggers

Three layers, each simple on its own:

1. **RLS** decides which rows a user may read or write (policies on every table, proved by `pnpm db:test`).
2. **Column privileges** decide which columns the Data API may write at all. Clients can never write
   counters, `popularity_score`, `status` on insert, `author_id`, `slug` after insert, `counts_in_average`,
   report handling fields, or anything in `audit_log`. Owner columns get defaults (`author_id default auth.uid()`).
3. **Guard triggers** cover the per-actor rules that privileges cannot express (an author edits content but
   not status; a moderator changes status but not content; only admins change roles).

Rules apply to Data API callers (`anon`, `authenticated`). Trusted server code (secret key, migrations,
cron, import scripts) runs as `service_role`/`postgres` and is not restricted. Internal helpers live in
the `private` schema, which the API does not expose.

### D15. Staff powers

- **Moderator**: sees the pending queue, all reports and the audit log; publishes/hides/rejects resources,
  overrides link status, hides comments, handles reports, bans regular users.
- **Admin**: everything a moderator can do, plus topics, the domain blocklist, roles, and banning staff.
- Nobody changes their own role or ban state. Staff hide content instead of deleting it; only authors
  delete their own resources and comments. Banned users (staff included) lose all write access.

### D16. Audit log written by triggers

Moderation happens through the staff member's own session (RLS), never with the secret key, so triggers
know the actor (`auth.uid()`) and log every status change, ban, role change, report decision, topic and
blocklist change with before/after values. The log is append-only: no role can update or delete it
through the API. Changes made without a signed-in user (jobs, scripts) are not moderation and are not logged.

### D17. Instant publishing vs. the pending queue

The database decides a new card's status; clients cannot send it. **Trusted** = staff, or an account at
least 3 days old with 3+ published resources and no confirmed (resolved) reports against its content —
broken-link reports do not count. Everyone else, including accounts older than 3 days with only 1–2
published cards (a gap in the brief), goes to `pending`. Reports store `target_owner_id` at creation, so
deleting reported content does not erase it from the author's record.

"Editing keeps it published unless the URL changes (then re-check)": a new URL always resets the link
check (`link_status = unknown`), and for untrusted authors also sends the card back to `pending`, so a
good link cannot be swapped for spam after approval. Slugs never change, so shared links keep working.

### D18. Ratings from new accounts

Ratings from accounts younger than 24 hours are stored and shown but **excluded** from the average and
the popularity score (`counts_in_average = false`). The flag is recomputed when the rating is edited, so an
edit after 24 hours counts — the same as rating later. `ratings_count`/`ratings_sum` include counted
ratings only, so the displayed average and its count always match.

### D19. Popularity score

`score = (likes + 2·saves + Σ(stars − 3)) / (age_in_days + 2)^1.5`, with age measured from `published_at`.
A 5★ rating adds 2 points, a 1★ rating removes 2, 3★ is neutral. The brief's example used hours; with
the expected volume (a few cards per day) that would let one like on a fresh card outrank weeks-old
cards with hundreds of likes, so the unit is days. The constant lives in `private.popularity_score`
(documented there). Counter triggers recompute a card's score immediately; a pg_cron job recomputes all
published scores daily at 02:00 Tashkent time, because the score decays even without interactions.

### D20. No liking, saving or rating your own resource

The brief forbids self-likes and self-ratings. Saves weigh twice as much as likes in the popularity score,
so self-saves are forbidden too. Only published resources can be liked, saved, rated or commented on.

### D21. What is public

Public: profiles, topics, published resources, ratings with reviews, published comments.
Private to the user: likes, saves, topic follows; user follows are visible to the follower and the
followed person only. The public sees counters, not who liked or saved. Authors see their own pending,
hidden and rejected cards and their hidden comments.

### D22. Search normalization

Search text is lower-cased and every apostrophe variant (ʻ ʼ ' ‘ ’ and the backtick) is removed, so
"Oʻzbek", "o'zbek" and "ozbek" are the same token — Postgres would otherwise split `o'zbek` into two
words. The stored `search_vector` (config `simple`) weights title A, summary B, `for_whom` C; a trigram
index on the normalized title handles typos. Phase 5 queries must normalize input with
`private.normalize_search_text`.

### D23. Reference data in a migration, not `seed.sql`

The 12 topics and the URL-shortener blocklist are needed in every environment, including production,
and `supabase db push` does not run `seed.sql`. They are inserted by a migration with
`on conflict do nothing`. `seed.sql` stays for local demo data (Phase 10). Topic `name_ru`/`name_en`
stay empty: Russian content is out of scope. `youtu.be` and `t.me` are not blocked: they are canonical
links to real content.

### D24. Resource URLs

The app stores URLs already normalized (Phase 4); the unique constraint on `url` then detects duplicates
across all statuses, so a rejected spam link cannot be re-posted. The database additionally requires
http(s), a lower-case ASCII host (IDNs in punycode), no credentials and no whitespace. `domain` is a
generated column (host without `www.`), so it can never disagree with the URL. Blocked domains match
the domain and all its subdomains. `published_at` (not in the brief) records the first publication;
feeds and the popularity decay use it so a card approved after two days in the queue is not born old.

### D25. Reports

One **open** report per user and target, which also gives "one broken-link report per user per
resource" (a user may report again after the earlier report was handled). Broken-link reports carry
no reason; all other reports require one. Reporters can only report what they can see.

### D26. Deferred to later phases

- Rate limits (section 6.3) — Phase 7, together with auth and report limits; the mechanism (table +
  function, or counting recent rows in triggers) is chosen there.
- Removal requests from guests (`/removal-request`) — they need contact details and anonymous
  submission, so they get their own table in Phase 7.
- Content heuristics (ALL CAPS titles, emoji floods, URL-only summaries) — Zod validators in Phase 4.

### D27. Database tests with pgTAP

`supabase/tests/database/*.test.sql` prove RLS, privileges, triggers, counters and the audit log
(152 checks). Run with `pnpm db:test` (`supabase test db`). They need the local Docker stack, so they
are not part of `pnpm check`. Each file is self-contained and rolls back.

### D28. Avatars

Public `avatars` bucket, 1 MiB limit, JPEG/PNG/WebP only (no SVG: it can carry scripts). Files live under
`<user id>/`; Storage policies let users write only their own folder. Public URLs need no read policy.

### D29. Usernames

`^[a-z0-9_]{3,30}$`, lower-case so uniqueness is case-insensitive. The sign-up trigger takes the username
from sign-up metadata; if it is invalid or taken, it adds a random suffix (`user_3f9a1c`) instead of
failing the sign-up. Usernames are never derived from the email address, because they are public.

## Deployment

### D30. Environment variables are checked before the build

The first Vercel deploy answered every request with a bare "Internal Server Error": a malformed
`NEXT_PUBLIC_*` value only fails when the proxy parses it at request time, and the build itself
succeeded. `pnpm build` now runs `scripts/check-env.ts` first (loading `.env*` files the same way as
`next build`), so a bad value fails the build with the variable's name. URLs must be http(s), values are
trimmed, and Vercel production builds require `NEXT_PUBLIC_SITE_URL`. The check lives in the build script,
not `next.config.ts`, because `next typegen` (part of `pnpm check`) loads the config in the build phase too.

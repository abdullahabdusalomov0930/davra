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
Changed in `src/lib/config.ts` (`APP_NAME`), `package.json` and the local Supabase `project_id`.
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

### D31. Production migrations through GitHub Actions

Vercel builds `main`; a GitHub Action applies `supabase/migrations` to the production project with
`supabase db push` whenever a push to `main` changes them, so the site and the schema move together and
nobody runs commands against production by hand. Credentials live only in GitHub repository secrets.
Supabase's own GitHub integration was not used because its production deploys run through the paid
branching feature. Migrations are never edited after they reach `main` (CLAUDE.md).

## Phase 3 — Auth, profiles, settings

### D32. Auth requests go from the browser to Supabase

> Superseded by D74: authentication now runs on the server.

Sign-up, sign-in, resend, password-reset and recovery requests use the browser Supabase client.
Supabase Auth rate-limits by IP; from Server Actions every student would share the server's few IPs,
so one busy class could lock everyone out. Nothing secret is involved (publishable key, user's own
password over HTTPS), and Supabase validates the input itself. Server code never sees passwords: it
reads the session from the cookie with `getClaims()` (`getViewer()`), and profile changes go through
Zod-validated Server Actions. Signing out is a Server Action so the cookies are cleared on the response.

### D33. Email links use `token_hash`, confirmed by a button

Our Uzbek templates (`supabase/templates/`) link to `/email-tasdiqlash` and `/parolni-tiklash/yangi`
with a `token_hash`. Unlike the default PKCE link, this works when the email is opened on another
device. The token is spent only when the person presses the button (or submits the new password):
corporate mail scanners open links automatically and would otherwise use up the one-time token. A PKCE
`code` is still accepted: Supabase allows editing cloud templates only once custom SMTP is configured,
and until then its default emails link with a code (works in the same browser; on another device the
address is confirmed anyway and the person signs in). The browser client therefore has
`detectSessionInUrl: false`; otherwise it would exchange the code itself when created and the page's
own exchange would fail. Confirmed users land on `/sozlamalar` with a welcome note to complete their profile.

### D34. Redirects happen in the proxy

Pages stream (root `loading.tsx`), and a `redirect()` inside a streamed page becomes a client-side one
with a 200 status. So the proxy, which already knows whether a session exists, sends guests from
protected pages to `/kirish?next=…` (307), signed-in users away from `/kirish` and `/royxatdan-otish`,
and `/u/Nodira` to `/u/nodira` (308). Pages still check the user themselves (`requireViewer`), so the
proxy is not the only guard. `?next=` only accepts same-site paths (`safeRedirectPath`). A missing
profile is a streamed 404 with `noindex`, which Next.js documents as the expected behavior.

### D35. Usernames

Lower-case `[a-z0-9_]{3,30}`, one canonical URL `/u/<username>`. A reserved list (admin, moderator,
davra, …) is enforced by a database constraint and by the forms; a unit test keeps both lists equal.
The sign-up form checks availability first for a friendly message; the database stays the authority
(the sign-up trigger adds a suffix on a race, profile updates map the unique violation to a field error).

### D36. Avatars

The browser crops the picture to the centre square and re-encodes it as a 256×256 WebP (JPEG where
WebP encoding is unavailable), which also strips EXIF data such as GPS location. The Server Action
checks size and the file's magic bytes (not the declared type), uploads under a new random name (so
CDN caches never serve an old picture), points the profile at it, then deletes the previous file.
Avatars from anywhere but our Storage are blocked by the CSP and fall back to initials.

### D37. Scope of the settings page

Display name, username, avatar, bio, university and field of study, as the brief lists. Changing
email or password while signed in and deleting the account are not in the brief and are not built;
"forgot password" covers password changes. Passwords: 8–72 characters (bcrypt ignores bytes after 72).

### D38. Email delivery

Supabase's built-in sender only delivers to members of the Supabase team and a few emails per hour.
It is fine for testing; a custom SMTP provider must be configured before students are invited
(README, cloud setup step 5), and it is also what unlocks editing the email templates. The provider and
sender domain are the owner's choice.

## Phase 4 — Resource cards

### D39. URL normalization

The stored link is what the database's unique constraint compares, so the app normalizes it once, in the
shared Zod schema (`src/lib/url-normalize.ts`): a bare domain gets `https://`, the host is lower-cased
(IDNs become punycode), the fragment and tracking parameters (`utm_*`, `fbclid`, `gclid`, `yclid`,
`igshid`, YouTube's `si`/`feature`, …) are removed, other parameters keep their exact text and order, and
YouTube links get one form (`https://www.youtube.com/watch?v=…`). The path is kept as written: some sites
serve `/kurs` and `/kurs/` differently, and a link must keep working. Links with credentials, IP
addresses or intranet hosts (`localhost`, `*.local`, …) are refused; resources are public web pages. The
form replaces the field with the normalized link when it loses focus, so the author sees what is saved.

### D40. Duplicate detection

The unique constraint on the normalized URL is the authority. Before saving, and when the link field loses
focus, the server also looks for the same page spelled differently (with or without `www.`, `http` or
`https`, with or without a trailing slash; links over 500 characters are matched exactly to keep the
request small). This lookup uses the secret key because the existing card may be pending or hidden; the
author only gets its slug when they may open it (published, or their own), otherwise a note that the link
is waiting for review. That reveals that a link is in the queue, nothing else; accepted.

### D41. Favicons

Favicons come from DuckDuckGo's icon service (`https://icons.duckduckgo.com/ip3/<domain>.ico`): no key, no
tracking cookies, and the shared site never sees our visitors. Images load lazily without a referrer and
fall back to a globe icon. The CSP allows only that origin. If it ever becomes a problem, a small cached
proxy route can replace it without touching the components (`src/lib/favicon.ts`).

### D42. Slugs

Generated from the title on creation: Uzbek Cyrillic is transliterated (`ш` → `sh`, `ў` → `o`, `қ` → `q`,
…), every apostrophe form is dropped (`oʻ` → `o`), at most 80 characters cut at a word boundary. Slugs never
change afterwards, so shared links keep working when the title is edited. A taken slug gets a random
4-character suffix (up to four attempts against the unique constraint).

### D43. Who sees and changes a card

The database decides the status (D17): trusted authors and staff publish at once, everyone else waits in
the queue; the form tells new members so. Only the author edits content; staff moderate from the admin
panel (Phase 7). Editing text keeps the status; a new link sends a non-trusted author's card back to
review. Editing a hidden or rejected card does not republish it. Delete is permanent (likes, ratings and
comments go with it) and needs a confirmation. A card that is not public is a streamed 404 with `noindex`
for everyone else (D34). The daily limits (3 new cards for new members, 10 for trusted) come with the
other rate limits in Phase 7.

### D44. Content rules

One Zod schema validates in the browser and again in the Server Action: title 3–120 characters and not
ALL CAPS (10+ letters, none lower-case; short acronyms like "IELTS" are fine), at most 2 emoji in the title
and 5 in each text, a summary of at least 40 characters besides any links. Messages are translation keys.

## Phase 5 — Feed, topics, search

### D45. One read path for every list

The feed, topic pages, related resources and search all call `public.search_resources` (a Postgres
function exposed through the Data API). It decides which published cards match and in what order and
returns their ids with a cursor for each row; the app then loads the cards with their topic and author by
id. One function means one place for visibility rules (explicitly `status = 'published'`, plus RLS since it
runs with the visitor's rights), one cursor format and one set of tests (`06_search.test.sql`). It builds
its query from fixed SQL fragments; every value is a parameter.

### D46. Search matching

Uzbek has no Postgres dictionary, so the `simple` configuration indexes words as written, with apostrophes
removed and lower-cased (D22). Every word of the query must match, either as a full-text prefix in the
title, summary or for whom ("dastur" finds "dasturlash"), or fuzzily in the title (pg_trgm
`word_similarity` ≥ 0.4 for words of 3+ letters: "pyton", "matematka"). Requiring every word keeps the
fuzzy match from pulling in cards that share one common word. A Cyrillic query is also searched in its
Latin transliteration, since most cards are written in Latin. Known limit: two swapped letters in a short
word ("pyhton") are too different for trigrams; a longer query or a correct spelling finds it.

### D47. Sorting and paging

- Home: **Mashhur** by default, so a first visit shows the best cards at once; **Yangi** as a tab. The
  **Obunalarim** tab comes with follows in Phase 6.
- Topic pages: **Eng yaxshilari** by default, **Yangi** as a tab. Search: best match when there is a
  query, otherwise newest; top rated on request.
- Top rated uses `rating_score = (ratings_sum + 2·3) / (ratings_count + 2)`: the average pulled towards a
  neutral 3 by two virtual ratings, so one 5-star rating does not beat ten 4.5-star ones.
- Pages use keyset cursors that the database builds for each row (opaque base64url in URLs). Floats are
  written as exact text (`extra_float_digits`; Supabase's default would round them to 15 digits and
  repeat cards). Best-match pages use an offset, which is fine for a few pages. A card whose popularity
  changes between two requests can move; the list never shows a card twice.
- "Yana koʻrsatish" appends the next page in place and is also a plain link (`?keyin=…`), so it works
  without JavaScript and search engines can follow it.
- Search result URLs are `noindex, follow`; the search page itself, topics and the home page are indexed.

### D48. Cards are rendered on the server

Relative dates ("3 kun oldin") and month names need Uzbek locale data, which not every browser has
(Chromium builds without it print "M10"). Lists therefore receive server-rendered cards, and "load more"
returns server-rendered cards from its Server Action; the client only appends them. The request config also
fixes one "now" per request, so any date formatted in a client component matches the server.

## Phase 6 — Likes, saves, ratings, comments, follows

### D49. Obunalarim

The following feed is `search_resources(following_only => true)`: published resources whose author the
visitor follows or whose topic they follow, newest first, with the same cursors and filters as every other
list (D45). Follows are private (D21), and the function runs with the visitor's rights, so it can only
see the visitor's own follows; guests get an empty list. `/obunalarim` shows the feed with the followed
topics and people above it, and members get it as a third home tab. Follower counts are not shown,
since who follows whom is private.

### D50. Likes and saves

Buttons update at once and roll back with a message if the server refuses (own resource, card no longer
published, banned account: all enforced by RLS, D20). Writes are idempotent: liking twice or unliking
something not liked succeeds, so double clicks and retries are harmless. Like and save do not re-render
the page; counters are kept by database triggers and show up on the next visit. A list fetches the
visitor's likes and saves for its cards in two small queries and renders the cards on the server (D48).
Cards show the like count; saves are personal bookmarks, so their count is not shown.

### D51. Ratings and comments

- A rating is saved with update-then-insert, not an upsert: an upsert would need UPDATE on `resource_id`,
  which users do not have (column privileges, D14).
- Reviews are the ratings that come with text; ratings without text count in the average only. A young
  account's rating is shown with a note that it will count once it is updated after 24 hours (D18).
- Comments are flat and cannot be edited (as in Phase 2); their author can delete them, with
  confirmation, like every destructive action. Staff hide comments from the admin panel (Phase 7).
- After a rating or comment is saved, the page refreshes from the server, so averages, counts and lists
  always match the database.
- Daily limits for comments, likes and saves come with the other rate limits in Phase 7.

## Phase 7 — Reports, moderation, rate limits

### D52. Rate limits

Limits from the brief live in the database, so they hold for every client: 3 new resources a day (10 for
trusted authors), 30 comments a day, 100 likes and saves an hour together, and 20 reports a day. Each
limited insert by a signed-in user records an event in `private.rate_events`; a BEFORE INSERT trigger
counts the user's events in the window and refuses the insert past the limit (`rate_limited`, with the
action as detail, so the form can say which limit was hit). Events are counted rather than rows, so
like–unlike–like does not reset anything, and an insert that fails for another reason rolls its event
back. Staff and trusted server code are not limited. A daily pg_cron job prunes old events.
Sign-up, sign-in and password-reset requests are limited per IP by Supabase Auth itself (D32); guest
removal requests are limited per IP by the server (D53).

### D53. Removal requests

`/removal-request` needs no account: a rights holder may not want one. The Data API grants no insert on
`removal_requests`; the app's server validates the form, checks the per-IP limit (3 a day) and inserts
the row with the secret key. That is the only place outside scripts and jobs where the secret key writes
data; handling a request is still done by staff through their own session and audited. The IP address
itself is never stored, only an HMAC of it keyed with the server's secret. A hidden honeypot field drops
naive bots. The sender's name and email are kept for the reply and are visible to staff only; the
privacy policy (Phase 9) must mention them.

### D54. Moderation panel

`/admin` is for moderators and admins; everyone else gets a 404, and every query and action also goes
through RLS with the staff member's own session, so the audit log records the actor (D16). Powers follow
D15: moderators handle the queue, reports and bans of regular users; topics, the domain blocklist, roles
and banning staff are for admins, and the panel shows those sections read-only to moderators. A report
can be **taken down** (the resource or comment is hidden, or the user banned, and the report is resolved,
which counts against the author's trust, D17), **resolved** without action, or **dismissed**. Destructive
decisions ask for confirmation. Staff also get a moderation toolbar on resource pages and hide or show
comments in place. Reporters are anonymous to everyone but staff.

### D55. Spam rules

Content rules (no ALL-CAPS titles, emoji limits, summaries that are more than a link) are checked by the
shared Zod schema in the browser and in the Server Action (D44). They are not duplicated as database
constraints: a client calling the Data API directly could skip them, but not the structural limits, the
blocklist, the rate limits or the pending queue, and new members' cards are reviewed by a person anyway.

### D56. Link checker: schedule and results

A Route Handler (`/api/cron/link-check`) does the checking and Vercel Cron calls it once a day; the
Hobby plan allows one cron run a day, and doing the HTTP work in Node rather than in Postgres (pg_net)
lets us control DNS, redirects and time limits (D57). Each run takes the published links whose last check
is more than 7 days old (never checked first), checks six sites at a time and one request at a time per
site, and stops starting new checks after 40 seconds so it ends inside the route's 60-second limit; the
rest wait for the next day. A HEAD request goes first; anything but a clear "ok" is asked again with GET,
whose answer counts (many servers answer HEAD wrongly).

Results are recorded through `record_link_check(resource_id, checked_url, outcome)`, which only the
service role may call: `ok` resets the failure count and sets the link ok, `failure` adds one and marks
the link broken from the second failure in a row, `unknown` stores only the check time. A result for a
link the author has changed meanwhile is ignored. Outcomes: 2xx/3xx are ok; 404, 410, 5xx, a domain
that does not exist, a refused connection, a timeout or a private address are failures; 401, 403, 429,
other 4xx, Cloudflare challenges, too many redirects, TLS certificates Node cannot verify (often a
missing intermediate or a national CA that browsers handle) and temporary DNS errors are unknown. Broken
links get a warning on the card and the page and leave the "Mashhur" feed (the popular sort has left them
out since Phase 5).

Staff's "Hozir tekshirish" runs the same checker on one link and records the result the same way, with
the secret key, after an explicit staff check in the Server Action. It records what the checker saw,
not a person's decision, so like the scheduled run it is not in the audit log. Staff decisions —
"Ishlamayapti", "Ishlayapti", hiding — go through the staff member's own session and are audited (D16);
they also close the link's open "Havola ishlamayapti" reports (resolved when broken, dismissed when it
works). A staff "Ishlayapti" is not sticky: if the checker keeps failing (e.g. a site that blocks
foreign servers), the link is marked broken again after two more weekly failures. If that happens with
real sites, add a per-resource "checked by hand" flag.

### D57. SSRF protection in the link checker

Links come from users, so the checker must not become a way to reach our own network or the cloud
metadata service. It only fetches http and https URLs, uses `node:http`/`node:https` with a custom DNS
lookup that resolves every address of the host and refuses the host if any of them is not public
(private, loopback, link-local, CGNAT, multicast, documentation and other special ranges; for IPv6 only
global unicast outside the special blocks, which also refuses IPv4-mapped and NAT64 forms), and connects
to exactly the address it checked, so DNS rebinding between check and connect is impossible. IP literals
are checked before connecting, every redirect target is checked again, and at most 5 redirects are
followed. Connections are not pooled, the body is never downloaded (the response is dropped after the
headers), and each attempt has a time limit (4 s for HEAD, 7 s for GET, redirects included).

### D58. Protecting the cron route

Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is set. The route compares the
header with SHA-256 digests and `timingSafeEqual`, and refuses every call while `CRON_SECRET` is missing
or shorter than 16 characters, so a missing variable cannot leave the route open. The variable is
optional for the build (the site works without it) but `scripts/check-env.ts` warns about it in
production. "Havola ishlamayapti" reports from members do not trigger a check: that would let anyone
make the server send requests; they go to the Havolalar page, where staff can check at once.

### D59. Search engines and sharing

Every public page sets its title, description (cut to about 160 characters at a word boundary) and
canonical URL; "Yangi", filters and cursors share their page's canonical URL, and search results with
parameters stay `noindex`. OpenGraph and Twitter tags come from the root layout (site name, `uz_UZ`,
large image card), with `article` on resource pages and `profile` on profiles. JSON-LD (`<` escaped,
nonce added): `WebSite` with a `SearchAction` on the home page; on resource pages a `LearningResource`
whose `url` is the external material and `mainEntityOfPage` the Davra page, with the sharer as
`contributor` (not `author`: they did not make the material), the counted average as `aggregateRating`,
and a `BreadcrumbList`; `ProfilePage` on profiles; breadcrumbs on topic pages. Only published resources
get structured data.

Share images are drawn with `next/og`. Its built-in font has no oʻ/gʻ (U+02BB) or Cyrillic, and for
missing glyphs it would download fonts from Google at request time, so Inter (OFL) is bundled: Latin in
two weights, Latin Extended and Cyrillic in bold for titles, each subset a separate family in a
fallback chain. The resource image is regenerated at most hourly and falls back to the site image for
anything not public. The sitemap and share images read through a session-less "guest" client, so a
moderator or an author fetching them never leaks pending or hidden cards; the sitemap is built per
request (`force-dynamic`), so builds never need the database. `robots.txt` closes account, admin and API
paths, and closes everything on Vercel previews.

### D60. Weekly top

`/haftalik` ranks the last 7 days (a rolling window, so the page is never empty on a Monday morning)
with the popularity weights of D19 applied to that week's activity only: like 1, save 2, counted rating
`stars − 3`. Only published resources with working links and a positive score are listed, at most 10;
there is no padding with older favourites, and an empty week shows an empty state that points to the
feed. Likes and saves are private rows, so `weekly_top_resources` is SECURITY DEFINER and returns only
per-resource totals; the cards are then loaded through RLS as in every other list.

### D61. Legal pages, icons and manifest

The legal texts are drafts written for this product (links only, no piracy, what data is stored and
where) and say so in a banner until a lawyer has reviewed them. They live in `messages/uz.json` as
arrays of sections rendered with `t.raw`, with `{appName}` filled in by the page; a unit test checks
their shape and the Uzbek letters. The contact address is optional (`NEXT_PUBLIC_CONTACT_EMAIL`);
until it is set the pages point to the report button and the removal form. For the lawyer: Uzbekistan's
personal data law may require citizens' personal data to be stored on servers in Uzbekistan, while the
database is in Frankfurt (README); this needs a decision before launch.

The logo (lucide "book-open" on the primary colour) is defined once in `src/lib/brand.ts`; `pnpm icons`
renders the favicon, SVG icon, Apple touch icon and manifest icons from it, and the share images use the
same mark. Brand colours are repeated there as hex because images and the manifest cannot read CSS
variables.

### D62. Page loading and performance

The root `loading.tsx` streamed every page as a skeleton first and swapped in the content when its data
arrived. On a phone that cost more than it gave: the swap moved the footer (layout shift 0.17), the
largest paint waited for the swap, missing pages could only answer 200 with `noindex` (D34), and
`generateMetadata` was streamed into `<body>` for ordinary browsers. Server responses are fast (one or two
queries), so pages now render completely before the first byte; the topic page's skeleton went too, and
only search keeps one (it changes on every filter). Client-side navigation keeps the old page until the
new one is ready. Only the Latin subset of Inter is preloaded; the others are declared with their
`unicode-range` and load when a page needs them. Zod is configured `jitless` in `src/lib/zod.ts`, because
its `eval` probe trips the CSP in browsers. Result on mobile Lighthouse: Performance 88–96, CLS 0.

### D63. Tests and demo data

Four layers: unit tests (Vitest) for pure code; pgTAP for everything the database enforces (RLS, triggers,
limits, ranking), because that is where the security model lives; Playwright end-to-end tests for the flows
in the acceptance criteria; and axe-core inside Playwright for WCAG 2.1 AA on every page, in light and dark
mode. The end-to-end run starts from `db:reset` + `db:seed` so it is repeatable; it therefore only runs
against the local stack.

Demo data comes from a CSV file through the same importer admins use, so the importer is exercised by
every seed. The importer writes with the secret key (it runs on an admin's machine, not in the app), but
only in a moderator's or admin's name, validates every row with the form's schema before writing
anything, and skips existing links, so re-running a file is safe. The seed script refuses non-local
databases because its accounts share a published password.

### D64. Safety check before every user text, enforced by the database

The security addendum (which overrides the brief where they differ) asks for automatic checks on every
submission. Users write through the Supabase Data API with their own session (D14), so a check that
lived only in the server actions could be skipped by calling the API directly. Instead the server checks
a submission (`src/server/safety/evaluate.ts`: text policy, link policy, trust level, near-duplicates)
and, unless it refuses it, issues a **safety ticket** with the secret key: user, kind, SHA-256 of exactly
the fields that will be written (joined with U+001F, the same function in SQL and TypeScript) and the
decision. `safety_check` triggers on resources, comments, ratings (review text) and profiles take the
matching ticket for Data API writes and refuse the write without one (`unchecked_submission`). A ticket
is used once and expires after 15 minutes; a failed statement rolls its use back, so a retry works.
Writes that change no text (stars only, level, a moderator's status change) need no ticket; trusted
server code (imports, seed, jobs) does not go through the Data API roles and is not checked.

`needs_review` makes a resource or comment `pending` whatever the author's trust; ratings and profiles
have no queue, so there the server refuses what it would hold. Comments therefore gained the `pending`
status: the author and staff see a pending comment, it is not counted, and staff publish or hide it on
`/admin/izohlar`. Why something was held or refused is stored in `moderation_events` (internal reason
codes such as `text.scam:summary`, an excerpt; staff only, kept 180 days) and shown to moderators next
to the queue entry, never to the author, who only sees a general message per field.

Trust levels are computed for now (`my_trust_level()`: 0 new or banned, 1 trusted author as in D18,
3 staff). Level 0 cards always wait (as before); a level 0 comment with a link waits, one without
publishes after the text check. The stored `trust_level` column with promotion rules comes with the
report and appeal work (addendum layer 2). Account names chosen at sign-up do not pass the check yet,
because sign-up runs in the browser (D32); that changes when sign-up moves to the server.

### D65. Link policy

`src/server/safety/url-policy.ts`, on top of `normalizeUrl` (D22): http(s) only, no credentials, no IP
addresses or intranet names, ports 80/443 only (new), tracking parameters removed (`ref` too, except on
code hosts where it names a branch). Then a built-in list of link shorteners (refused with a request
for the full address, `data/shorteners.json`), a category blocklist (`data/blocked-domains.json`: adult,
gambling, piracy and piracy file hosts are refused; general file hosting is held for review) and
lookalike domains: a label mixing Latin, Cyrillic or Greek letters, or one written only in Cyrillic or
Greek letters that look Latin, is refused; genuine Cyrillic domains pass. The admin-editable
`blocked_domains` table keeps working in the database.

The server then follows the link with `safeFetch` (HEAD, at most 3 redirects, 5 s, the SSRF rules of
D57) and applies the same rules to where it really leads; a redirect into a private network is refused,
a longer chain is held, and a site that does not answer is let through (the weekly link check looks
again). The final address is stored on the card (`final_url`, set only from the ticket, and checked
against `blocked_domains` by the trigger). If `SAFE_BROWSING_API_KEY` is set, both addresses are looked
up in Google Safe Browsing (behind the `UrlReputationProvider` interface); a flagged link is refused,
and without a key the check is skipped with one warning in the log.

Profile photos and site favicons are gone (addendum override): nothing is uploaded or stored, avatars
are initials on a colour derived from the username, and no page loads images from another site, so
`img-src` is `'self' data:`.

### D66. Text policy and word lists

Every text is cleaned by the Zod schemas, so forms and server agree (`src/lib/clean-text.ts`): NFKC
(stylised letters become plain ones; superscripts, subscripts and fractions stay, since x² and H₂O
matter in learning material), no invisible or control characters, single spaces, at most three of the
same letter or symbol in a row, line breaks only in multi-line fields. Then `text-policy.ts` checks: no
links in one-line fields and at most one in longer texts (a domain counts as a link only with a scheme,
`www.` or a path, so "Node.js" and "ASP.NET" do not), no text that is little more than a link, no phone
numbers or Telegram/WhatsApp invites (refused in cards, reviews and profiles, held in comments), and the
word lists. ALL CAPS titles and emoji limits stay in the schemas.

The word lists (`src/server/safety/data/words/{uz,ru,en}.json`) are starter lists to be extended by the
owner, in six categories. Hate, sexual, drug or weapon selling, scam and profanity are refused;
gambling is held, because some of its words have innocent uses. Matching compares words in Uzbek Latin
and sees through simple disguises: case, repeated letters, dots, dashes or spaces between letters,
digits and symbols for letters, accents, stylised Unicode, and Latin/Cyrillic/Greek lookalikes inside a
word. It matches whole words, stems (`kazino*`) and phrases, never letters inside other words, so
"class" does not contain "ass". Entries that collide with ordinary words are left out on purpose: the
Russian "хуй" reads "xuy" (Uzbek "temper"), "stavka" alone is an interest rate ("foiz stavkasi"),
"tez pul" is a money transfer. A rejection tells the author which field to change, not which rule
matched. A card whose title and summary share 80 % of their words with one the same author shared in
the last 24 hours is refused as a repeat.

### D67. Trust levels

`profiles.trust_level` (security addendum layer 2) replaces the computed "trusted author" of D18.
Level 0: account younger than 3 days, no published card yet, or a confirmed violation (a report on
their content that staff resolved) in the last 14 days. Level 1: at least one published card. Level
2: three or more. Level 3: moderators and admins; banned users count as 0. Level 1 publishes cards at
once when the safety check allows them (the addendum's rule; before, three published cards were
needed); level 2 also gets the higher card limit (10 a day) and more weight in reports. Triggers keep
the level current when a card's status, a report's status, a role or a ban changes, and an hourly job
covers account age and the end of the 14-day window. An admin can set a level by hand; it then stays
until they give the user back to the automatic rules. Demotion on a confirmed violation is to 0, for
14 days.

### D68. Reports, weights and automatic hiding

New reasons: severe, illegal, pirated, scam_phishing, harassment (plus the old ones). Each report is
weighed when it is filed: staff 3, level 2 1.5, level 1 1, level 0 0.5, an account younger than a day
0.25; a reporter whose reports in the last 90 days were mostly dismissed counts half (60 %, at least 3
handled) or a quarter (80 %, at least 5). When the open reports about a published card or comment
reach weight 3 (2 if any is about illegal content or a scam), it is hidden at once with
`moderation_state = 'auto_hidden'`, its author is notified with the reason most reports gave, and it
goes to the top of the queue. Both thresholds are settings (`app_settings`, /admin/sozlamalar).
Moderators decide all open reports about an item together: take down (hide and resolve), resolve, or
dismiss, which gives an automatically hidden item back. One open report per person and item, 20
reports a day, and severe reports have their own limit of 3 a day, because each hides content at once.

### D69. Severe content

A report with the reason "severe" (child safety, terrorism or violent extremism, credible threats)
hides the card or comment immediately (even a pending one) and stores a frozen JSON copy of it, with
the author's id, the timestamps and every severe report, in `severe_incidents`, which only admins can
read. The author is told only that the item was hidden. Content with an open incident cannot be
deleted until an admin marks the incident "preserved" (the copy exists from the first report, the
marking makes the decision explicit). The admin page never links to or loads the reported link: it
shows the domain and a copyable address. Dismissing a severe report is for admins only. What the law
requires next (reporting to authorities) is left to the owner and a lawyer (docs/INCIDENT_RESPONSE.md).
The severe-report limit (D68) is the safeguard against using the button to hide content at will.

### D70. Notifications and appeals

Authors learn about decisions in the app, not by e-mail: `notifications` (written by triggers and the
moderation functions) for hidden, rejected or restored content, bans and their end, warnings and
appeal decisions, with the rule (a link to its section of /qoidalar) and the moderator's reason. Each
decision can be appealed once: a hidden or rejected card, a hidden comment, or a ban (banned users can
appeal although they can write nothing else). Accepting an appeal restores the item or lifts the ban.
Content hidden because its author was banned is covered by the ban notice and returns with the unban.

### D71. Every moderation action has a reason

Moderators act through database functions (`moderate_resource`, `set_user_ban`, `handle_reports`,
…) that run with their own rights (SECURITY INVOKER, so RLS and the guards apply as before) and set the
reason for the transaction. The audit trigger refuses a staff change to someone else's content or
account without a reason (`reason_required`), so the rule holds for direct API calls too, and writes
the reason to `audit_log.reason`. The same text reaches the affected user in the notification, so the
dialog says so. Technical changes are exempt: link status, closing broken-link reports, topics,
blocklists (which have their own reason field) and settings. Automatic hiding is logged with no actor
("Tizim"). Bans now have an end (1, 7 or 30 days; `banned_until`, lifted every 10 minutes) or are
permanent; a ban hides the user's published cards and comments (`moderation_state = 'author_banned'`)
and lifting it brings them back. The ban reason is not a public column: the user and staff read it
through `ban_details()`.

### D72. Two-step severe actions

Permanent bans and deleting content are admin powers in the database (a moderator's attempt fails).
In the panel a moderator's "delete" or "permanent ban" becomes a request (`pending_actions`) that an
admin confirms or turns down on /admin/sorovlar; the confirmation runs with the admin's rights and is
audited with both names. Deletion of someone else's content is logged with what was deleted.

### D73. Link safety for readers

Outbound links open in a new tab with `rel="noopener noreferrer nofollow ugc"`, the real domain is
shown on every card, and nothing from a linked site is embedded or fetched for display. A link opens
the "Siz tashqi saytga oʻtyapsiz" page (/tashqi/<slug>) first when its domain was new to Davra when a
member below trust level 2 shared it (`resources.unvetted_domain`) and its reputation is not "safe";
admins can switch this off or extend it to every link not known to be safe. The weekly link check
also asks the reputation service again about every link it checks (and where it leads) and hides a
newly flagged one with `moderation_state = 'reputation_flagged'`; the author is told.

### D74. Authentication on the server

The addendum asks for HttpOnly session cookies and rate limits per IP and per e-mail address, which a
browser-side sign-in (D32) cannot give. Sign-in, sign-up, password reset, resending the confirmation,
confirming the address and setting a new password are now Server Actions; the browser no longer talks
to Supabase at all (the CSP's connect-src is 'self'), and the session cookies are HttpOnly, SameSite=Lax
and Secure in production. Passwords need 10 characters, may not be one of a built-in list of common
passwords or a simple run, and may not contain the username or the e-mail name (set the same minimum
in the Supabase dashboard). Sign-up names pass the text policy. Every attempt is rate limited through
`src/server/rate-limit.ts` (Postgres sliding window keyed by HMAC hashes of the IP or e-mail; another
store can implement the same interface); the same module limits text searches (60 a minute per
address) and new links per address. Cloudflare Turnstile is optional (both keys set) on sign-up and on
level-0 members' cards. With REQUIRE_RECENT_LOGIN_FOR_ADMIN=true, admins must have signed in within 15
minutes (the session's `amr` time) before admin actions. Server inputs use strict Zod objects, so
unknown fields are refused.

### D75. Auth events and IP retention

`auth_events` records sign-ins, failures, sign-ups, reset requests, password changes, limits hit,
failed bot checks and deleted accounts with hashed e-mail and IP, for admins only; /admin/xavfsizlik
lists addresses with 10+ failures or 3+ new accounts in a day. Events and the IP hashes of removal
requests are deleted after 30 days, rate-limit hits after 8. The HMAC key is the Supabase secret key,
so rotating it also unlinks old hashes. Server errors are logged as one JSON line without query
strings, cookies or bodies (`src/instrumentation.ts`, where a tracker such as Sentry can be added).

### D76. Account deletion and export

/sozlamalar offers a JSON copy of everything the user wrote or chose (read through RLS, so only their
own rows) and deletion of the account after the username and password are typed again. Deleting the
auth user cascades to the profile and with it the user's cards (and their comments and ratings),
comments, ratings, likes, saves, follows, appeals and notifications. Reports they filed stay without a
name, the audit log keeps actions without the actor, and severe-incident evidence is kept (no foreign
key), as the privacy policy says. Removing everything rather than anonymizing cards is the simpler and
more private choice for an MVP; cards others found useful are lost with the account.

### D77. Visual identity: cream, ink and orange; a serif for headings; quiet motion

The temporary teal look is replaced by a warm editorial style, after the owner chose cloaked.com as the
reference: a cream background, ink text, a burnt-orange primary (#c9450e, the brightest orange that
still gives white text 4.8:1) and warm near-black for dark bands, the footer and dark mode. The bright
orange (#ff5a1f, `--brand`) is for shapes and the logo only; on cream it is 2.9:1, too low for text.
Headings use Source Serif 4 with its optical-size axis, body text stays Inter. Literata was tried
first and dropped because it gives oʻ/gʻ (U+02BB) no width, so the mark lands on the next letter;
Newsreader, Fraunces and most display serifs lack U+02BB entirely. The logo is a ring with an
off-centre opening ("davra" is a circle of people), also used as the motif in pictures.

The landing page for guests (hero with search, a dark "problem" band, features, steps, numbers,
topics and an invitation) is built from real data: cards, topics and authors from the database; the
pictures are product mock-ups in HTML, not photos, because the CSP allows no remote images and there
are no uploads (D63). Motion is CSS only: entrance and scroll-driven fades, floating cards, turning
rings and a topics marquee, all off under `prefers-reduced-motion`, and the still state is the final
state, so nothing is hidden when an animation does not run. axe checks the still page.

### D78. "Daftar": a squared notebook page, a sticker logo and magnet dots

Replaces the look of D77 after the owner compared several directions on a design canvas and chose
"B1 · Daftar". The page is squared paper (28px cells ruled in light blue, a red margin line left of the
page column on wide screens) with ink outlines and hard offset shadows, like paper cut-outs. Colours:
paper #fdfcf7 and ink #111111; a blue ballpoint (`--primary` #1f4fb8, white on it 7.3:1) for links,
focus and handwritten notes; a yellow highlighter (`--marker` #ffe45c, ink on it 14.8:1) for the main
action and for marked words; pastel post-it notes for pictures. Notes stay paper in dark mode (ink on
pastel, via the fixed `--ink`/`--pen` tokens); dark mode itself is the same notebook at night (#121317,
faint blue rules, chalk-white lines, a lighter pen #8fb0ff). On dark backgrounds a marked word is
written in the marker colour instead of highlighted, because ink-on-yellow would leave the top of the
letters on the dark page.

Type: Unbounded for headings (round and wide, like letters drawn with a marker), Onest for text, Mali
for handwritten notes in the margins of the landing page (not preloaded, it is used only there). All
three have oʻ/gʻ (U+02BB) and ʼ (U+02BC) with real widths; Unbounded kerns ʻ close over the preceding
o or g, a deliberate design of the face. Arrows and the pencil next to notes are small SVG doodles,
because the handwriting font has no arrow characters.

The logo is a die-cut sticker: four rounded squares on white, tilted −6° in the interface and upright
in app icons. Its colours (mustard #d9a400, orange #f07a3a, purple #7b5cf0, green #2e9e6b, clockwise
from the top left) are also the "magnet dots": where the grid lines cross near a mouse pointer, dots
appear, are pushed away from it and take the colour of the logo square in the same corner, so the
logo forms around the pointer. The effect is a canvas under the page (it never takes the pointer and is
not read out), runs only for a mouse or pen on a device that can hover, never under
`prefers-reduced-motion` or forced colours, and stops drawing between moves. Share images use the
same paper, sticker and Unbounded (Latin and Cyrillic files in src/assets/fonts, OFL).

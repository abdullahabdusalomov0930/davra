# Security

How Davracha defends itself and its users, what is not covered, how to report a vulnerability and how to
rotate keys. To report a problem, go straight to [Reporting a vulnerability](#reporting-a-vulnerability).

Related documents:

- [DECISIONS.md](DECISIONS.md): the reasoning behind each control (security model D14–D16, SSRF D57,
  cron route D58, content safety D64–D66, trust, reports and moderation D67–D73, authentication,
  logging and privacy D74–D76).
- [docs/MODERATION_GUIDE.md](docs/MODERATION_GUIDE.md) (Uzbek): how moderators decide.
- [docs/INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md): severe content, leaked keys, account takeover,
  data leaks.
- [README.md → Backups and restore](README.md#backups-and-restore) and
  [Security checklist before launch](README.md#security-checklist-before-launch).

## Threat model

Davracha lets students publish text and a link, nothing else: no files, no images, no avatars (initials
only). That removes image and file moderation from the problem; what remains is below.

| Threat                            | Examples                                                                                                                       | How it is handled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Where in code                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Illegal or prohibited content** | pirated books and courses, extremist material, content sexualizing minors, threats, drug or weapon trade, gambling, fraud      | Every text passes the word lists (hate, sexual, drugs and weapons, scam, gambling); links to adult, gambling and piracy sites are refused. New members' cards wait for a moderator. Weighted reports hide content automatically; a "severe" report hides it at the first report and stores a frozen copy for admins. Rules with examples on `/qoidalar`; rights holders use `/removal-request`.                                                                                                                         | `src/server/safety/`, `src/server/safety/data/`, `supabase/migrations/20261012090100_trust_and_reports.sql`, `/admin/shikoyatlar`, `/admin/jiddiy`                    |
| **Malicious links**               | phishing, malware, scam shops, link shorteners hiding the target, redirect chains                                              | Link policy: http(s) only, no IP addresses, intranet names or non-standard ports, shorteners refused, lookalike (mixed-script) domains refused, category blocklist plus the admin-editable `blocked_domains`. The server follows redirects (at most 3, SSRF-safe) and checks the final address with the same rules. Optional Google Safe Browsing at submit time and weekly. Readers see the real domain, an interstitial page for new unvetted domains, `rel="noopener noreferrer nofollow ugc"`; nothing is embedded. | `url-policy.ts`, `safe-fetch.ts`, `reputation.ts` (all in `src/server/safety/`), `src/server/link-check/job.ts`, `src/lib/outbound.ts`, `src/app/tashqi/[slug]/`      |
| **Spam and manipulation**         | mass posting, fake ratings, vote rings, affiliate or referral spam, SEO spam                                                   | Per-user limits in the database (cards, comments, likes and saves, reports) and per-IP limits on the server; one card per normalized URL; near-duplicate check (80 % shared words within 24 hours); phone numbers and Telegram/WhatsApp invites refused or held; link limits in texts; level-0 members reviewed; no liking or rating your own card, one rating per person; `nofollow ugc` removes any SEO value.                                                                                                        | `src/server/rate-limit.ts`, `supabase/migrations/20261010190000_limits_and_removal_requests.sql`, `src/server/safety/text-policy.ts`, `src/server/safety/evaluate.ts` |
| **Abuse between users**           | harassment, hate speech, doxxing, impersonation                                                                                | Word lists on every text, including names chosen at sign-up; phone numbers refused in cards, reviews and profiles and held in comments; report button on cards, comments and profiles; warnings, hiding and bans with a reason the user sees; reserved usernames (`admin`, `moderator`, `davra`, …); reporters are anonymous to everyone but staff.                                                                                                                                                                     | `src/server/safety/word-filter.ts`, `supabase/migrations/20261010150000_reserved_usernames.sql`, `supabase/migrations/20261012090200_moderator_tools.sql`             |
| **Technical attacks**             | XSS, CSRF, SQL injection, SSRF through the link checker, brute force, account takeover, privilege escalation, IDOR, data leaks | React escaping, no user HTML, CSP with nonce and `strict-dynamic`; Server Actions (Origin check) and SameSite=Lax cookies; parameterized queries only; one SSRF-safe fetcher; rate limits, a password policy and an auth event log; Row Level Security on every table with guard triggers and column privileges; secrets only in server-only modules. Details below.                                                                                                                                                    | `src/proxy.ts`, `src/lib/security/csp.ts`, `next.config.ts`, `src/server/actions/`, `src/server/safety/safe-fetch.ts`, `supabase/migrations/`                         |
| **Platform misuse**               | bots, scraping of user data, mass account creation                                                                             | Sign-up limited per IP, e-mail confirmation required before anyone can sign in, optional Cloudflare Turnstile on sign-up and on level-0 members' cards, search limited per IP, cursor pagination with a fixed page size, no bulk export (the only export is a user's own data), e-mail addresses are never public; suspicious addresses on `/admin/xavfsizlik`.                                                                                                                                                         | `src/server/actions/auth.ts`, `src/server/auth/turnstile.ts`, `src/server/auth/events.ts`, `supabase/migrations/20261012090300_auth_security.sql`                     |

## Implemented controls

### Content safety at submit time

- **One check for every user text** (`src/server/safety/evaluate.ts`, `screen.ts`): cards, comments,
  rating reviews, profiles, and the names chosen at sign-up. The result is allow, hold for a moderator,
  or refuse with an Uzbek message that names the field to change, not the rule that matched.
- **The database enforces it** (DECISIONS.md D64). After its check the server issues a single-use
  _safety ticket_ (SHA-256 of exactly the fields that will be written, valid 15 minutes,
  `src/server/safety/tickets.ts`). Triggers on `resources`, `comments`, `resource_ratings` and
  `profiles` refuse a Data API write without a matching ticket, so calling the Supabase API directly
  does not skip the checks.
- **Link policy** (`url-policy.ts`, D65): http and https only; no credentials, IP addresses, `localhost`
  or intranet names; ports 80 and 443 only; tracking parameters (`utm_*`, `fbclid`, `gclid`, `ref`, …)
  removed; link shorteners refused with a request for the full address; lookalike domains (a label
  mixing Latin, Cyrillic or Greek letters, or Cyrillic letters that only imitate Latin ones) refused;
  a category blocklist (adult, gambling and piracy refused, general file hosting held). The server then
  follows the link with `safeFetch` (HEAD, at most 3 redirects, 5 s) and applies the same rules to the
  final address; a redirect into a private network is refused. With `SAFE_BROWSING_API_KEY` set, both
  addresses are looked up in Google Safe Browsing behind the `UrlReputationProvider` interface.
- **Text policy** (`text-policy.ts`, `word-filter.ts`, D66): texts are cleaned first (NFKC, invisible
  and control characters removed, whitespace collapsed, at most three repeated characters,
  `src/lib/clean-text.ts`); then link limits (none in one-line fields, one in longer texts), no text
  that is little more than a link, phone numbers and Telegram/WhatsApp invites, and word lists for
  Uzbek (Latin and Cyrillic), Russian and English that see through common disguises (leetspeak, dots or
  spaces between letters, repeated letters, accents, stylised Unicode, Latin/Cyrillic/Greek
  homoglyphs). ALL-CAPS titles and emoji limits are in the Zod schemas.
- **Near-duplicates**: a card whose title and summary share 80 % of their words with one the same
  author shared in the last 24 hours is refused.
- **Lists the owner extends**: starter lists in `src/server/safety/data/` (`blocked-domains.json`,
  `shorteners.json`, `words/{uz,ru,en}.json`). Admins add words on `/admin/sozlamalar`
  (`blocked_terms`, picked up within a minute) and domains with a category on `/admin/domenlar`
  (`blocked_domains`, enforced by the database on the link and on where it leads).
- Why something was held or refused is stored in `moderation_events` (internal reason codes, an
  excerpt; staff only, deleted after 180 days) and shown to moderators next to the queue entry.

### Trust levels, reports and moderation

- **Trust levels** (`profiles.trust_level`, D67): 0 for an account younger than 3 days, without a
  published card, or with a confirmed violation in the last 14 days; 1 with at least one published
  card; 2 with three or more; 3 for staff; banned users count as 0. Triggers and an hourly job keep it
  current; admins can set it by hand. Level 0: every card and every comment with a link waits for a
  moderator. Level 2: higher card limit and more report weight.
- **Weighted reports** (D68): reasons `severe`, `illegal`, `pirated`, `scam_phishing`, `spam`,
  `harassment`, `wrong_info`, `inappropriate`, `copyright`, `other`. Weights: staff 3, level 2 1.5,
  level 1 1, level 0 0.5, accounts younger than a day 0.25; a reporter whose recent reports were mostly
  dismissed counts half or a quarter. Open reports with a total weight of 3 hide a published card or
  comment (2 when one of them is `illegal` or `scam_phishing`); both thresholds are settings on
  `/admin/sozlamalar`. One open report per person and item, 20 reports a day, 3 severe reports a day.
- **Severe content** (D69): hidden at the first report (even while pending), a frozen JSON copy with
  author id, timestamps and every severe report goes to `severe_incidents` (admins only), the author
  is not told why, the content cannot be deleted until an admin marks the incident "preserved", and
  `/admin/jiddiy` shows only the domain and a copyable address, never a link or a preview. Only admins
  can dismiss a severe report.
- **Notifications and appeals** (D70): in-app notices on `/bildirishnomalar` for hidden, rejected and
  restored content, bans, warnings and appeal decisions, with a link to the rule on
  `/qoidalar#<rule>` and the moderator's reason. One appeal per decision; queue on `/admin/etirozlar`.
- **Every moderation action has a reason** (D71): staff act through database functions that run with
  their own session (RLS applies), and the audit trigger refuses a staff change to someone else's
  content or account without a reason. The reason goes to `audit_log` (viewer on `/admin/jurnal`) and
  to the affected user. Actions: approve, reject, hide, restore, delete, warn, ban for 1, 7 or 30 days
  or permanently; admins also block domains and words. A ban hides the user's published content and
  lifting it brings the content back; temporary bans end by themselves (checked every 10 minutes).
- **Two-step severe actions** (D72): permanent bans and deletions are admin powers in the database; a
  moderator's request waits on `/admin/sorovlar` for an admin.

### Link safety for readers

- Every outbound link: `target="_blank"`, `rel="noopener noreferrer nofollow ugc"`, and the real domain
  next to it (`src/lib/outbound.ts`).
- `/tashqi/<slug>` ("Siz tashqi saytga oʻtyapsiz") opens first for links to domains that were new to
  Davracha when a member below level 2 shared them and whose reputation is not "safe". Admins choose off,
  new domains (default) or every link not known to be safe (D73).
- No embeds, previews, favicons or remote images: the CSP allows `img-src 'self' data:` only.
- The weekly link check also asks the reputation service again; a newly flagged link is hidden, its
  author told, and it goes to the moderators.

### Authentication and sessions

- Authentication runs on the server (Server Actions in `src/server/actions/auth.ts`, D74). The browser
  never talks to Supabase (CSP `connect-src 'self'`); session cookies are HttpOnly, SameSite=Lax and
  Secure in production (`src/lib/supabase/cookies.ts`).
- Passwords: at least 10 characters (72 at most, bcrypt's limit), not on the built-in list of common
  passwords and not containing the username or the name part of the e-mail address
  (`src/lib/validators/password.ts`). Supabase's own minimum must be set to 10 as well (README).
- E-mail confirmation is required before the first sign-in. Answers never reveal whether an address
  has an account.
- Optional: Cloudflare Turnstile on sign-up and on level-0 members' cards (both
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`); `REQUIRE_RECENT_LOGIN_FOR_ADMIN=true`
  makes admins sign in again (within 15 minutes) before admin actions.
- Deleting an account asks for the username and the password again.

### Authorization

- Row Level Security on every table (D14–D16): guests read published content, users write only their
  own rows, banned users are read-only, `severe_incidents` and `auth_events` are admin-only,
  `audit_log`, `moderation_events` and `pending_actions` staff-only.
- Users cannot set their own role, trust level or ban: column privileges and guard triggers refuse it.
  Status fields and counters are set by triggers only.
- Staff use their own session for every moderation action, never the secret key, so the audit log
  knows the actor.
- Admin pages are guarded three times: the proxy (`isProtectedPath` in `src/proxy.ts`), the admin
  layout (`requireStaff`), and RLS on every query and function.
- The pgTAP tests in `supabase/tests/database/` try privilege escalation, cross-user reads and writes,
  banned-user writes and admin-only tables.

### Input validation and output encoding

- Every Server Action and route handler validates input with strict Zod objects from
  `src/lib/validators` (unknown fields are refused).
- User text is rendered as plain text by React; nothing is auto-linked. The only
  `dangerouslySetInnerHTML` is the JSON-LD block, with `<` escaped (`src/components/seo/json-ld.tsx`).
- Queries go through supabase-js or database functions with `set search_path = ''`; no SQL is built
  from strings.

### HTTP

- Headers (`next.config.ts`, `src/proxy.ts`): Content-Security-Policy with a per-request nonce and
  `strict-dynamic` (`default-src 'self'`, `img-src 'self' data:`, `connect-src 'self'`,
  `frame-ancestors 'none'`, `object-src 'none'`; `frame-src` allows only Cloudflare Turnstile when it is
  configured), Strict-Transport-Security (2 years, `includeSubDomains`, `preload`),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone,
  geolocation, payment and USB off), `Cross-Origin-Opener-Policy: same-origin`. Styles allow
  `'unsafe-inline'` (see Known limitations).
- CSRF: mutations are Server Actions, which Next.js refuses when the `Origin` host differs from the
  site's host; cookies are SameSite=Lax. The only route handler, `/api/cron/link-check`, is a GET that
  requires `Authorization: Bearer $CRON_SECRET` (constant-time comparison; refused while the secret is
  missing or shorter than 16 characters).
- No CORS headers: same-origin only.
- `pnpm security:smoke [url]` checks the headers on public pages and that the cron route refuses calls.

### Rate limits

Server-side limits (`src/server/rate-limit.ts`): a sliding window in Postgres (`hit_rate_limit`),
keyed by an HMAC of the IP address, e-mail address or user id (never the value itself), behind a
`RateLimitStore` interface so another store can replace it.

| Action                     | Limit                                                        |
| -------------------------- | ------------------------------------------------------------ |
| Sign-in                    | 20 per 15 minutes per IP, 10 per 15 minutes per e-mail       |
| Sign-up                    | 5 per hour per IP                                            |
| Password reset             | 10 per hour per IP, 3 per hour per e-mail                    |
| Resend confirmation e-mail | 10 per hour per IP, 3 per hour per e-mail                    |
| Text search                | 60 per minute per IP                                         |
| New links                  | 30 per day per IP                                            |
| Appeals                    | 10 per day per user                                          |
| Removal requests (guests)  | 3 per day per IP (`src/server/services/removal-requests.ts`) |

Database limits per user (D52, D68), enforced by triggers for every client: 3 new cards a day (10 at
level 2), 30 comments a day, 100 likes and saves an hour together, 20 reports a day, 3 severe reports a
day.

### SSRF

`src/server/safety/safe-fetch.ts` is the only way server code requests a user's URL (submit-time check
and link checker; D57): http and https only, ports 80 and 443, no credentials; every address a host
resolves to must be public (private, loopback, link-local including `169.254.169.254`, CGNAT,
multicast and other special ranges, IPv4 and IPv6), and the connection goes to exactly the address
that was checked, so DNS rebinding does not work; every redirect is checked again, at most 3; at most
8 seconds and 1 MB; a fixed User-Agent, no cookies, no connection reuse. Unit tests cover private
addresses and redirects into private networks with mocked DNS.

### Secrets and configuration

- The secret key and API keys are read only in `src/server/**` (modules import `server-only`), never
  in `NEXT_PUBLIC_*` variables. Environment variables are validated with Zod; `pnpm build` fails on a
  missing or malformed one and prints its name, never its value (`scripts/check-env.ts`).
- `.env.example` documents every variable; `.gitignore` excludes `.env*` except the template.
- Secret scanning: `pnpm hooks:install` enables a pre-commit hook (`.githooks/pre-commit`) that runs
  `scripts/check-secrets.ts` and gitleaks if installed; `pnpm secrets:scan` checks every tracked file;
  the CI job runs gitleaks over the full history (`.gitleaks.toml` adds a rule for Supabase secret
  keys).

### Logging and monitoring

- Server errors are logged as one JSON line with path, route and digest, without query strings,
  cookies, bodies or personal data (`src/instrumentation.ts`, where an error tracker such as Sentry
  can be added). Tokens and keys are never logged.
- `audit_log`: every staff action with actor, target, time and reason; automatic actions appear as
  "Tizim".
- `auth_events`: sign-ins, failures, sign-ups, resets, password changes, limits hit, failed bot checks
  and deleted accounts, with hashed IP and e-mail (admins only). `/admin/xavfsizlik` lists addresses
  with 10 or more failed sign-ins or 3 or more new accounts in the last 24 hours.

### Privacy

- Stored about a user: e-mail (in Supabase Auth only), username, display name, optional bio,
  university and field of study, and what they post. No IP addresses: only keyed hashes, deleted after
  30 days (`auth_events`, removal requests); rate-limit hits after 8 days.
- `/sozlamalar`: download your data as JSON, or delete the account. Deletion removes the user's cards,
  comments, ratings, likes, saves, follows, appeals and notifications; reports they filed stay without
  a name; audit entries keep the action without the actor; severe-incident evidence is kept (D76).

### Dependencies and CI

- `.github/workflows/ci.yml` runs on every pull request and push to `main`: lint, typecheck, format
  check, unit tests, `pnpm audit --audit-level high`, a production build and gitleaks. Actions are
  pinned to commit SHAs. One advisory is ignored by ID, with the reason in the workflow:
  GHSA-vfj7-8cjw-p6xm (`braces`, no fixed release yet), reached only through build tools that never see
  untrusted glob patterns.
- `.github/dependabot.yml`: weekly updates for npm and GitHub Actions, with a 3-day cooldown. The
  lockfile is committed.

## Known limitations

- **Filters are imperfect.** The word lists are short starter lists. New slang, misspellings, other
  languages, text inside images on linked sites and context all get past them, and innocent texts are
  sometimes held. They reduce the moderators' work; they do not replace moderators and reports.
- **Link checks see what Davracha's server sees.** A site can show the server something else than a
  visitor, or change after it was approved; links are re-checked about once a week, not at every click.
  A site that does not answer at submit time is let through and left to the link checker.
- **Safe Browsing and Turnstile work only when configured.** Without `SAFE_BROWSING_API_KEY` no
  reputation service is asked; without the Turnstile keys bots meet only the rate limits and e-mail
  confirmation. Google's Safe Browsing API is meant for non-commercial use; if Davracha earns money, check
  Google's terms (its commercial counterpart is Web Risk).
- **Rate limits are per IP and per account.** Students behind one university or mobile network share
  an IP; someone with many addresses gets around per-IP limits. If the limiter's database call fails,
  it lets the request through (the database's per-user limits still apply). The IP comes from
  `x-forwarded-for` as Vercel sets it; behind another proxy, adjust `src/server/request.ts`.
- **Supabase Auth's own limits now count the server.** Sign-in runs on the server, so Supabase's per-IP
  limits see Vercel's addresses, not each student's (the concern noted in D32). If sign-ins fail with
  "too many requests" under normal load, raise them in Supabase → Authentication → Rate Limits; Davracha's
  own limits stay per student.
- **No detection of coordinated accounts** (vote rings, sockpuppets) beyond the per-IP sign-up limit,
  report weights and `/admin/xavfsizlik`. A banned user can open a new account.
- **No two-factor authentication in the app**, for staff either. Protect the owner accounts (GitHub,
  Supabase, Vercel, Cloudflare, Google Cloud) with 2FA; consider `REQUIRE_RECENT_LOGIN_FOR_ADMIN`.
- **No e-mail notifications.** Users see decisions only when they open `/bildirishnomalar`.
- **Moderation is people.** Queues have no response-time guarantee; the guide is in
  `docs/MODERATION_GUIDE.md`.
- **No history of edits.** Davracha keeps the current version of a card or profile; an edit after approval
  is checked again but the old text is not kept (severe incidents are the exception).
- **The audit log is not tamper-proof.** It lives in the same database; anyone with the secret key or
  dashboard access can change it. Retention for `audit_log` and `severe_incidents` is not set yet.
- **Content can live on elsewhere.** Search engines and messaging apps (Telegram link previews) may keep
  copies of a card after it is hidden.
- **CSP allows inline styles** (`style-src 'unsafe-inline'`): React and the UI library set `style`
  attributes. Scripts are locked down by nonce.
- **Database and end-to-end tests do not run in CI**: they need the local Supabase stack. Run
  `pnpm db:test` and `pnpm test:e2e` before merging schema or flow changes.
- **Legal.** The terms, privacy policy and rules are drafts awaiting a lawyer. Uzbekistan's personal
  data law may require citizens' data to be stored in Uzbekistan, while the database is in Frankfurt
  (D61). What Davracha must report to authorities about severe content is not known yet
  (`docs/INCIDENT_RESPONSE.md`).

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

- **GitHub:** the repository's **Security** tab → **Report a vulnerability**, if private vulnerability
  reporting is enabled (owner: Settings → Code security → Private vulnerability reporting).
- **E-mail:** the contact address shown on the site's legal pages (`NEXT_PUBLIC_CONTACT_EMAIL`).

> **TODO (owner):** set a dedicated security contact (for example `security@<your-domain>`), write it
> here, and state how quickly you answer reports.

Include what you found, where (URL or file), steps to reproduce and what an attacker could do with it.
Test only with accounts you created; do not read or change other people's data beyond what proves the
problem, do not run denial-of-service or spam tests against the live site, and do not use social
engineering. Only the current deployment of `main` is supported.

## Rotating keys

Rotate a key at once when it may have leaked (committed, pasted in a chat or a screenshot, shown in a
log) and once before launch to replace everything used during development. After any rotation, check
the logs for misuse ([docs/INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md)). Vercel applies changed
environment variables only to new deployments: always redeploy (Vercel → Deployments → the latest
production deployment → Redeploy).

**`SUPABASE_SECRET_KEY`** (bypasses Row Level Security; rotate first)

1. Supabase → Project Settings → API Keys → Secret keys: create a new secret key.
2. Vercel → Project → Settings → Environment Variables: replace `SUPABASE_SECRET_KEY` (Production and
   Preview), keep it marked sensitive, and redeploy.
3. Check the site: sign in, share a card, open `/admin`.
4. Back in API Keys, delete the old secret key. If the project still has the legacy `service_role`
   and `anon` JWT keys enabled, disable them there too (Davracha uses only the new keys).
5. Update `.env.local` on any machine that runs `pnpm import:resources`.

The same key is the HMAC secret for rate-limit keys and for the IP and e-mail hashes in `auth_events`
and removal requests. Rotating it therefore restarts every rate-limit window and makes old hashes
unlinkable to new ones (`/admin/xavfsizlik` starts afresh). This is acceptable and needs no action.

**`CRON_SECRET`**: generate a new value (`openssl rand -hex 32`), replace it on Vercel (Production),
redeploy. Vercel Cron sends the new value by itself; the old one stops working with the new deployment.

**`SAFE_BROWSING_API_KEY`**: Google Cloud console → APIs & Services → Credentials → create a new API
key restricted to the Safe Browsing API, replace it on Vercel, redeploy, then delete the old key. While
a key fails, lookups count as "unknown" and the server logs the HTTP status.

**`TURNSTILE_SECRET_KEY`**: Cloudflare dashboard → Turnstile → the widget → rotate the secret key (or
create a new widget and replace both `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`),
update Vercel, redeploy.

**GitHub Actions secrets** (Settings → Secrets and variables → Actions), used by the migrations
workflow:

- `SUPABASE_ACCESS_TOKEN`: a personal token with access to every Supabase project of the account.
  Create a new one at https://supabase.com/dashboard/account/tokens, update the secret, delete the old
  token.
- `SUPABASE_DB_PASSWORD`: Supabase → Project Settings → Database → reset the database password, then
  update the secret and any saved connection strings (backups, `pnpm supabase link`). The app itself
  does not use the database password.

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are public by design (RLS and
the secret side protect the data); replace them only if they are abused.

## Backups

Supabase backups, an off-site `pg_dump` copy and how to test a restore:
[README.md → Backups and restore](README.md#backups-and-restore).

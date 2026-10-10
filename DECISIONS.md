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

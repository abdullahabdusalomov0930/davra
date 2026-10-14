# Davracha — notes for coding agents

- Product brief and phase plan: `claude-code-prompt.md` (written under the old working name "Resurs"; the product was then **Davra** and is now **Davracha**, see DECISIONS.md D81). Progress: `CHANGELOG.md`. Choices: `DECISIONS.md` (add new ones there).
- To continue: find the last finished phase in `CHANGELOG.md`, then do the next phase from section 10 of the brief. After a phase: `pnpm check`, run the app, summarize in 5–8 lines, commit.
- Local stack: Docker must be running; `pnpm db:start` starts Supabase (Studio at http://127.0.0.1:54323). `.env.local` holds the local keys (`pnpm db:status` prints them).
- Next.js 16.4 differs from older versions (`proxy.ts` instead of middleware, `retry` in error boundaries, `LayoutProps`/`PageProps` globals). Check the bundled docs in `node_modules/next/dist/docs/` before using an API.
- Node 24 via nvm: run `source ~/.nvm/nvm.sh && nvm use` before `pnpm` commands.
- Design (DECISIONS.md D78, "Daftar"): colours are tokens in `src/app/globals.css` (keep text pairs at WCAG AA; `--marker` is the highlighter for the main action, `--ink`/`--pen`/post-it colours stay fixed in dark mode for paper notes); h1/h2 use Unbounded (`font-heading`), margin notes Mali (`font-hand`). Utilities: `paper`, `marker`, `tape`, `shadow-hard*`. Motion utilities (`animate-rise`, `animate-float`, `reveal`, `marquee-track`) and the magnet dots do nothing under reduced motion; never hide content that only an animation reveals.
- No hard-coded UI strings: everything goes in `messages/uz.json`. Use `ʻ` (U+02BB) for oʻ/gʻ and `ʼ` (U+02BC) for the tutuq belgisi.
- Secrets only in `src/server/**` (imports `server-only`). Never log tokens or keys.
- Validate every server input with Zod schemas from `src/lib/validators`. Schema messages are `Validation.*` keys, never text. Import `z` from `@/lib/zod` (ESLint enforces it).
- Auth: sign-in/sign-up/reset/confirm run as Server Actions (`src/server/actions/auth.ts`, rate limited, logged in `auth_events`); the browser never talks to Supabase and the session cookies are HttpOnly. Server code reads the user with `getViewer()`/`getViewerProfile()` from `src/server/auth/session.ts`. Gate pages in `src/proxy.ts` (`isProtectedPath`) and in the page (`requireViewer`). See DECISIONS.md D32–D34, D74.
- Safety: user texts go through `screenSubmission` (`src/server/safety/`); the database refuses them without a safety ticket (D64). Moderation actions need a reason: use the moderation functions (`moderate_resource`, `set_user_ban`, …), see D71.
- Database: never edit an applied migration; add a new one. After a schema change run `pnpm db:reset`, `pnpm db:test` (pgTAP, needs Docker) and `pnpm db:types`. Security model and staff powers: DECISIONS.md D14–D16. Moderation must use the staff member's own session (RLS), not the secret key, so the audit log knows the actor.
- Before committing a phase: `pnpm check` (lint, typecheck, format, tests). Conventional Commits, one per phase.
- End-to-end: `pnpm test:e2e` (Playwright + axe) resets the local DB and loads `pnpm db:seed` demo data first. Demo logins are in README "Demo data".

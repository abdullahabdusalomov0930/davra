# Davra — notes for coding agents

- Product brief and phase plan: `claude-code-prompt.md` (written under the old working name "Resurs"; the product is now **Davra**). Progress: `CHANGELOG.md`. Choices: `DECISIONS.md` (add new ones there).
- To continue: find the last finished phase in `CHANGELOG.md`, then do the next phase from section 10 of the brief. After a phase: `pnpm check`, run the app, summarize in 5–8 lines, commit.
- Local stack: Docker must be running; `pnpm db:start` starts Supabase (Studio at http://127.0.0.1:54323). `.env.local` holds the local keys (`pnpm db:status` prints them).
- Next.js 16.4 differs from older versions (`proxy.ts` instead of middleware, `retry` in error boundaries, `LayoutProps`/`PageProps` globals). Check the bundled docs in `node_modules/next/dist/docs/` before using an API.
- Node 24 via nvm: run `source ~/.nvm/nvm.sh && nvm use` before `pnpm` commands.
- No hard-coded UI strings: everything goes in `messages/uz.json`. Use `ʻ` (U+02BB) for oʻ/gʻ and `ʼ` (U+02BC) for the tutuq belgisi.
- Secrets only in `src/server/**` (imports `server-only`). Never log tokens or keys.
- Validate every server input with Zod schemas from `src/lib/validators`.
- Database: never edit an applied migration; add a new one. After a schema change run `pnpm db:reset`, `pnpm db:test` (pgTAP, needs Docker) and `pnpm db:types`. Security model and staff powers: DECISIONS.md D14–D16. Moderation must use the staff member's own session (RLS), not the secret key, so the audit log knows the actor.
- Before committing a phase: `pnpm check` (lint, typecheck, format, tests). Conventional Commits, one per phase.

# Resurs — notes for coding agents

- Product brief and phase plan: `claude-code-prompt.md`. Progress: `CHANGELOG.md`. Choices: `DECISIONS.md` (add new ones there).
- Next.js 16.4 differs from older versions (`proxy.ts` instead of middleware, `retry` in error boundaries, `LayoutProps`/`PageProps` globals). Check the bundled docs in `node_modules/next/dist/docs/` before using an API.
- Node 24 via nvm: run `source ~/.nvm/nvm.sh && nvm use` before `pnpm` commands.
- No hard-coded UI strings: everything goes in `messages/uz.json`. Use `ʻ` (U+02BB) for oʻ/gʻ and `ʼ` (U+02BC) for the tutuq belgisi.
- Secrets only in `src/server/**` (imports `server-only`). Never log tokens or keys.
- Validate every server input with Zod schemas from `src/lib/validators`.
- Before committing a phase: `pnpm check` (lint, typecheck, format, tests). Conventional Commits, one per phase.

# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

# Resurs

A focused network where Uzbek students share and discover useful learning resources, each as a
structured card with a short review in Uzbek. Web MVP built with Next.js and Supabase.

> The product name is a placeholder; change it in `src/lib/site-config.ts`.

Project status: see [CHANGELOG.md](CHANGELOG.md). Design choices: [DECISIONS.md](DECISIONS.md).
Full product brief: [claude-code-prompt.md](claude-code-prompt.md).

## Requirements

- Node.js 24 (see `.nvmrc`; `nvm use`)
- pnpm (`corepack enable pnpm`)
- Docker Desktop (for the local Supabase stack)

## Local setup

```bash
nvm use
corepack enable pnpm
pnpm install

# Start Postgres, Auth, Storage, Studio and Mailpit in Docker
pnpm db:start

# Create your env file and paste the keys printed by `pnpm db:status`
cp .env.example .env.local

pnpm dev
```

Open http://localhost:3000.

Local service URLs (default ports):

| Service                       | URL                    |
| ----------------------------- | ---------------------- |
| Supabase API                  | http://127.0.0.1:54321 |
| Supabase Studio (DB UI)       | http://127.0.0.1:54323 |
| Mailpit (verification emails) | http://127.0.0.1:54324 |

## Environment variables

| Variable                               | Where           | Purpose                                                   |
| -------------------------------------- | --------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | public          | Canonical site URL, used for SEO and auth redirects       |
| `NEXT_PUBLIC_SUPABASE_URL`             | public          | Supabase project URL                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public          | Supabase publishable key (RLS applies)                    |
| `SUPABASE_SECRET_KEY`                  | **server only** | Supabase secret key; bypasses RLS. Never expose or commit |

## Supabase cloud setup

1. Create a project at https://supabase.com (pick the region closest to your users and Vercel functions).
2. Project Settings → API Keys: copy the URL, the publishable key and a secret key into `.env.local`
   (and later into Vercel).
3. Authentication → URL Configuration: set **Site URL** to your production URL and add
   `http://localhost:3000/**` and `https://<your-domain>/**` to **Redirect URLs**.
4. Authentication → Providers → Email: keep **Confirm email** enabled.
5. Configure a custom SMTP provider before launch: Supabase's built-in email sender is heavily rate-limited.
6. Link the CLI and push the schema (available from Phase 2):
   ```bash
   pnpm supabase login
   pnpm supabase link --project-ref <project-ref>
   pnpm supabase db push
   ```

## Scripts

| Command                             | What it does                                   |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm dev`                          | Start the dev server                           |
| `pnpm build` / `pnpm start`         | Production build / serve                       |
| `pnpm lint`                         | ESLint                                         |
| `pnpm typecheck`                    | Generate route types and run `tsc`             |
| `pnpm format` / `pnpm format:check` | Prettier                                       |
| `pnpm test`                         | Unit tests (Vitest)                            |
| `pnpm check`                        | Lint + typecheck + format check + tests        |
| `pnpm db:start` / `pnpm db:stop`    | Start / stop local Supabase                    |
| `pnpm db:status`                    | Show local URLs and keys                       |
| `pnpm db:reset`                     | Recreate the local DB from migrations and seed |

Seeding, end-to-end tests, cron jobs and the Vercel deploy guide will be documented as those phases land.

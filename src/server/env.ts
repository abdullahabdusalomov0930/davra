import "server-only";

import { z } from "@/lib/zod";

/** Server-only secrets. Never import this module from client components. */
const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().trim().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  return cached;
}

/**
 * The token Vercel Cron sends to /api/cron/* as `Authorization: Bearer …` (DECISIONS.md D58). Optional:
 * without it, or with one shorter than 16 characters, the cron routes refuse every call.
 */
export function getCronSecret(): string | undefined {
  const secret = process.env.CRON_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : undefined;
}

/** Google Safe Browsing (Lookup API v4) key; optional. Without it link reputation is not checked. */
export function getSafeBrowsingKey(): string | undefined {
  return process.env.SAFE_BROWSING_API_KEY?.trim() || undefined;
}

/** Cloudflare Turnstile secret; optional. Without it (or without the site key) the check is skipped. */
export function getTurnstileSecret(): string | undefined {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || undefined;
}

/**
 * Optional hardening (security addendum 5.1): admin actions need a sign-in in the last 15 minutes.
 * Off unless REQUIRE_RECENT_LOGIN_FOR_ADMIN is "true".
 */
export function requiresRecentLoginForAdmin(): boolean {
  return process.env.REQUIRE_RECENT_LOGIN_FOR_ADMIN?.trim() === "true";
}

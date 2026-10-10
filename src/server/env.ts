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

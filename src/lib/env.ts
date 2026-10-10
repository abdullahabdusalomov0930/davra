import { z } from "@/lib/zod";

// Trimmed, because a stray space pasted into a hosting dashboard would otherwise reach the Supabase client.
const httpUrl = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https?$/ }));

/** Public (browser-safe) environment variables. */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: httpUrl.default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
  /** Shown on the legal pages for questions and data requests; optional until there is one. */
  NEXT_PUBLIC_CONTACT_EMAIL: z.string().trim().pipe(z.email()).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Raw values. Each variable is referenced literally so Next.js can inline it into client bundles. */
export function readPublicEnv() {
  return {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined,
  };
}

let cached: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  cached ??= publicEnvSchema.parse(readPublicEnv());
  return cached;
}

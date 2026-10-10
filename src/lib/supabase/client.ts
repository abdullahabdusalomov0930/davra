import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Supabase client for Client Components. Uses the publishable key only. */
export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    // The email-link pages exchange `?code=` themselves, on a button press (DECISIONS.md D33). Automatic
    // detection would exchange it first, when the client is created, and make that explicit call fail.
    auth: { detectSessionInUrl: false },
  });
}

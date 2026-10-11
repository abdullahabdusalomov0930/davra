import "server-only";

import { hashKey } from "@/server/rate-limit";
import { createAdminClient } from "@/server/supabase/admin";

export type AuthEventKind =
  | "sign_in"
  | "sign_in_failed"
  | "sign_up"
  | "password_reset_requested"
  | "password_changed"
  | "rate_limited"
  | "captcha_failed"
  | "account_deleted";

/**
 * Records sign-in activity for spotting attacks (admins see failures and sign-ups per address on
 * /admin/xavfsizlik). E-mail and IP are stored only as keyed hashes and deleted after 30 days.
 */
export async function recordAuthEvent(
  kind: AuthEventKind,
  { email, ip, userId }: { email?: string; ip?: string; userId?: string | null },
) {
  const { error } = await createAdminClient()
    .from("auth_events")
    .insert({
      kind,
      user_id: userId ?? null,
      email_hash: email ? hashKey("email", email) : null,
      ip_hash: ip ? hashKey("ip", ip) : null,
    });
  if (error) console.error("auth event not recorded", { kind, code: error.code });
}

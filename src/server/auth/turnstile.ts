import "server-only";

import { getPublicEnv } from "@/lib/env";
import { getTurnstileSecret } from "@/server/env";

/**
 * Cloudflare Turnstile (optional, security addendum 5.5): on sign-up and on new members' first
 * cards. Enabled when both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set; otherwise
 * skipped with one warning in the log.
 */

let warned = false;

export function turnstileEnabled(): boolean {
  const enabled = Boolean(getPublicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY && getTurnstileSecret());
  if (!enabled && !warned) {
    warned = true;
    console.warn("Turnstile is not configured; sign-up and new members' posts are not checked for bots.");
  }
  return enabled;
}

/** True when the visitor passed the challenge, or when Turnstile is not configured. */
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token || token.length > 2048) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: getTurnstileSecret()!, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5_000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    console.warn("Turnstile verification failed", { reason: "network or timeout" });
    return false;
  }
}

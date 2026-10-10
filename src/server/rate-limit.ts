import "server-only";

import { createHmac } from "node:crypto";

import { getServerEnv } from "@/server/env";
import { createAdminClient } from "@/server/supabase/admin";

/**
 * Central rate limits (security addendum 5.5, DECISIONS.md D74): a sliding window per key, where a
 * key is a keyed hash of an IP address, an e-mail address or a user id (never the value itself).
 * Hits are stored in Postgres (hit_rate_limit) behind the RateLimitStore interface, so another store
 * (e.g. Redis) can replace it. Writes that create rows (cards, comments, likes, reports) are also
 * limited per user by the database itself (D52); these limits cover what has no row of its own.
 */

export interface RateLimitStore {
  /** Records one hit for the key; false when the window already holds `max` hits. */
  hit(bucket: string, keyHash: string, max: number, windowSeconds: number): Promise<boolean>;
}

export class PostgresRateLimitStore implements RateLimitStore {
  async hit(bucket: string, keyHash: string, max: number, windowSeconds: number) {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
      bucket,
      key_hash: keyHash,
      max_hits: max,
      window_seconds: windowSeconds,
    });
    if (error) {
      // A broken limiter must not lock everyone out; the database limits still apply.
      console.error("rate limit check failed", { bucket, code: error.code });
      return true;
    }
    return data;
  }
}

/** For tests: the same sliding window in memory. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(bucket: string, keyHash: string, max: number, windowSeconds: number) {
    const key = `${bucket}:${keyHash}`;
    const since = this.now() - windowSeconds * 1000;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > since);
    if (recent.length >= max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(this.now());
    this.hits.set(key, recent);
    return true;
  }
}

type KeyKind = "ip" | "email" | "user";

/** Every limit by name: how many hits per window for each kind of key. */
export const RATE_LIMITS = {
  // Sign-in attempts: per address (spraying) and per account (guessing).
  signIn: { ip: { max: 20, windowSeconds: 15 * 60 }, email: { max: 10, windowSeconds: 15 * 60 } },
  // Account creation throttled per address.
  signUp: { ip: { max: 5, windowSeconds: 60 * 60 } },
  passwordReset: { ip: { max: 10, windowSeconds: 60 * 60 }, email: { max: 3, windowSeconds: 60 * 60 } },
  resendConfirmation: { ip: { max: 10, windowSeconds: 60 * 60 }, email: { max: 3, windowSeconds: 60 * 60 } },
  // Search: 60 requests a minute per address (addendum 5.5).
  search: { ip: { max: 60, windowSeconds: 60 } },
  // New links on top of the per-user database limit: per address, against many accounts on one machine.
  linkSubmission: { ip: { max: 30, windowSeconds: 24 * 60 * 60 } },
  appeal: { user: { max: 10, windowSeconds: 24 * 60 * 60 } },
} as const satisfies Record<string, Partial<Record<KeyKind, { max: number; windowSeconds: number }>>>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Keyed hash, so the table never holds an address; the key is the server's secret. */
export function hashKey(kind: KeyKind, value: string, secret = getServerEnv().SUPABASE_SECRET_KEY): string {
  return createHmac("sha256", secret).update(`rate:${kind}:${value.trim().toLowerCase()}`).digest("hex");
}

let store: RateLimitStore = new PostgresRateLimitStore();

/** Tests swap in a MemoryRateLimitStore. */
export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

/**
 * Records a hit under each given key and says whether all of them are within their limit. Every key
 * is counted, so a refused attempt still counts against the others.
 */
export async function checkRateLimit(
  name: RateLimitName,
  keys: Partial<Record<KeyKind, string>>,
  secret?: string,
): Promise<boolean> {
  const limits: Partial<Record<KeyKind, { max: number; windowSeconds: number }>> = RATE_LIMITS[name];
  const results = await Promise.all(
    (Object.keys(limits) as KeyKind[])
      .filter((kind) => keys[kind])
      .map((kind) => {
        const limit = limits[kind]!;
        return store.hit(name, hashKey(kind, keys[kind]!, secret), limit.max, limit.windowSeconds);
      }),
  );
  return results.every(Boolean);
}

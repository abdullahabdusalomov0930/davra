import "server-only";

import { headers } from "next/headers";

/**
 * The visitor's IP address as the hosting proxy reports it (Vercel sets x-forwarded-for). Used only
 * in keyed hashes for rate limits (src/server/rate-limit.ts); never stored or logged as is.
 */
export async function clientIp(): Promise<string> {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
}

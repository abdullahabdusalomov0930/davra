import "server-only";

import { createHmac } from "node:crypto";

import type { ActionResult } from "@/lib/action-result";
import type { RemovalRequestData, RemovalRequestInput } from "@/lib/validators";
import { getServerEnv } from "@/server/env";
import { createAdminClient } from "@/server/supabase/admin";

/** Removal requests one IP address may send per day. */
const MAX_PER_IP_PER_DAY = 3;

/**
 * Keyed hash of the sender's IP: enough to count requests per address, useless to anyone who reads
 * the table. The key is the server's secret key, so it never leaves the server.
 */
function hashIp(ip: string): string {
  return createHmac("sha256", getServerEnv().SUPABASE_SECRET_KEY).update(`removal-request:${ip}`).digest("hex");
}

/**
 * Stores a public removal request. Senders have no account, so this is trusted server code: the
 * input is validated by the caller, the per-IP limit is checked here, and the row is inserted with
 * the secret key (the Data API grants no insert on this table, D53).
 */
export async function createRemovalRequest(
  data: RemovalRequestData,
  ip: string,
): Promise<ActionResult<keyof RemovalRequestInput>> {
  const admin = createAdminClient();
  const ipHash = hashIp(ip);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("removal_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (countError) {
    console.error("removal request count failed", { code: countError.code });
    return { ok: false, error: "unknown" };
  }
  if ((count ?? 0) >= MAX_PER_IP_PER_DAY) return { ok: false, error: "rateLimited" };

  const { error } = await admin.from("removal_requests").insert({
    resource_url: data.resourceUrl,
    requester_name: data.requesterName,
    requester_email: data.requesterEmail,
    details: data.details,
    ip_hash: ipHash,
  });
  if (error) {
    console.error("removal request insert failed", { code: error.code });
    return { ok: false, error: "unknown" };
  }
  return { ok: true };
}

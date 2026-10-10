import "server-only";

import { getPublicEnv } from "@/lib/env";
import { createAdminClient } from "@/server/supabase/admin";
import type { Database } from "@/types/database";

import { checkLink, type LinkCheckOutcome, type LinkCheckResult } from "./check-link";
import { forEachByKey } from "./pool";

// The link checker records results with the secret key through record_link_check, which nothing else
// may call (D56). It decides nothing on a person's behalf: staff decisions ("mark broken", "hide") go
// through the staff member's own session and the audit log, like every other moderation action.

type LinkStatus = Database["public"]["Enums"]["link_status"];
type AdminClient = ReturnType<typeof createAdminClient>;

/** Each published link is checked about once a week. */
const RECHECK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Links per run; whatever is left waits for the next daily run (oldest check first). */
const BATCH_SIZE = 250;
/** Sites checked at the same time; one request at a time per site. */
const CONCURRENCY = 6;
/** No check starts later than this into a run, so it ends within the cron route's 60 seconds. */
const START_WINDOW_MS = 40_000;

export type LinkCheckSummary = Record<LinkCheckOutcome, number> & {
  due: number;
  checked: number;
  /** Links that are broken after this run's check. */
  broken: number;
  errors: number;
};

function userAgent() {
  return `DavraLinkChecker/1.0 (+${getPublicEnv().NEXT_PUBLIC_SITE_URL})`;
}

function siteOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function record(admin: AdminClient, resource: { id: string; url: string }, outcome: LinkCheckOutcome) {
  const { data, error } = await admin.rpc("record_link_check", {
    resource_id: resource.id,
    checked_url: resource.url,
    outcome,
  });
  if (error) throw new Error(`record_link_check failed (${error.code ?? "no code"})`);
  return data;
}

/** One scheduled run: checks the links that are due and records each result as soon as it is known. */
export async function runLinkCheckJob(startedAt = Date.now()): Promise<LinkCheckSummary> {
  const admin = createAdminClient();
  const dueBefore = new Date(startedAt - RECHECK_AFTER_MS).toISOString();

  const { data: due, error } = await admin
    .from("resources")
    .select("id, url")
    .eq("status", "published")
    .or(`last_link_check_at.is.null,last_link_check_at.lt."${dueBefore}"`)
    .order("last_link_check_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);
  if (error) throw new Error(`Could not load the links to check (${error.code ?? "no code"})`);

  const summary: LinkCheckSummary = {
    due: due.length,
    checked: 0,
    ok: 0,
    failure: 0,
    unknown: 0,
    broken: 0,
    errors: 0,
  };
  const agent = userAgent();

  await forEachByKey(
    due,
    async (resource) => {
      const { outcome } = await checkLink(resource.url, { userAgent: agent });
      summary.checked++;
      summary[outcome]++;
      try {
        if ((await record(admin, resource, outcome)) === "broken") summary.broken++;
      } catch (recordError) {
        summary.errors++;
        console.error("Link check result not saved", { resourceId: resource.id, error: String(recordError) });
      }
    },
    { keyOf: (resource) => siteOf(resource.url), concurrency: CONCURRENCY, deadline: startedAt + START_WINDOW_MS },
  );

  return summary;
}

export type LinkRecheck = LinkCheckResult & {
  /** The link's status after this check; null if the link changed while it was being checked. */
  linkStatus: LinkStatus | null;
};

/**
 * Staff's "check now" on the Havolalar page: checks one link and records the result exactly like the
 * scheduled run. The caller must have made sure the viewer is staff; the secret key bypasses RLS.
 */
export async function recheckLink(resourceId: string): Promise<LinkRecheck | null> {
  const admin = createAdminClient();
  const { data: resource, error } = await admin.from("resources").select("id, url").eq("id", resourceId).maybeSingle();
  if (error) throw new Error(`Could not load the link (${error.code ?? "no code"})`);
  if (!resource) return null;

  const result = await checkLink(resource.url, { userAgent: userAgent() });
  return { ...result, linkStatus: await record(admin, resource, result.outcome) };
}

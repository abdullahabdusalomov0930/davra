import "server-only";

import type { ActionErrorKey, ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { BrokenLinkReportData, ReportData, ReportInput } from "@/lib/validators";
import type { Database } from "@/types/database";

import { rateLimitError } from "./db-errors";

type ReportRow = Database["public"]["Tables"]["reports"]["Insert"];

/**
 * Files a report as the signed-in user. The database resolves who owns the target, allows one open
 * report per user and target, and limits reports per day (D52).
 */
async function fileReport(row: ReportRow, duplicate: ActionErrorKey): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert(row);
  if (!error) return { ok: true };

  const limited = rateLimitError(error);
  if (limited) return { ok: false, error: limited };
  if (error.code === "23505") return { ok: false, error: duplicate };
  // The target does not exist or is not visible to the reporter.
  if (error.code === "23503") return { ok: false, error: "notFound" };
  if (error.code === "42501") return { ok: false, error: "forbidden" };
  console.error("fileReport failed", { code: error.code });
  return { ok: false, error: "unknown" };
}

export async function createReport(data: ReportData): Promise<ActionResult<keyof ReportInput>> {
  return fileReport(
    { target_type: data.targetType, target_id: data.targetId, reason: data.reason, details: data.details },
    "alreadyReported",
  );
}

/** "Havola ishlamayapti" on a published resource. Staff see these on the Havolalar page. */
export async function createBrokenLinkReport({ resourceId }: BrokenLinkReportData): Promise<ActionResult> {
  return fileReport({ target_type: "broken_link", target_id: resourceId }, "alreadyReportedLink");
}

import "server-only";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { ReportData, ReportInput } from "@/lib/validators";

import { rateLimitError } from "./db-errors";

/**
 * Files a report as the signed-in user. The database resolves who owns the target, allows one open
 * report per user and target, and limits reports per day (D52).
 */
export async function createReport(data: ReportData): Promise<ActionResult<keyof ReportInput>> {
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    target_type: data.targetType,
    target_id: data.targetId,
    reason: data.reason,
    details: data.details,
  });
  if (!error) return { ok: true };

  const limited = rateLimitError(error);
  if (limited) return { ok: false, error: limited };
  if (error.code === "23505") return { ok: false, error: "alreadyReported" };
  // The target does not exist or is not visible to the reporter.
  if (error.code === "23503") return { ok: false, error: "notFound" };
  if (error.code === "42501") return { ok: false, error: "forbidden" };
  console.error("createReport failed", { code: error.code });
  return { ok: false, error: "unknown" };
}

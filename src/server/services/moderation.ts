import "server-only";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { BlockedDomainData, TopicData, TopicInput } from "@/lib/validators";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

// Every function here runs with the staff member's own session: RLS and the guard triggers decide
// what each role may do, and the audit triggers record who did it (D15, D16). Never the secret key.

type DbError = { code?: string; message: string };

function moderationError(error: DbError, context: string): ActionResult<never> {
  if (error.code === "42501") return { ok: false, error: "forbidden" };
  console.error(`${context} failed`, { code: error.code });
  return { ok: false, error: "unknown" };
}

/** Ends an update by id; no row back means RLS (or the guard trigger) refused it. */
async function finish(
  query: PromiseLike<{ data: { id: string }[] | null; error: DbError | null }>,
  context: string,
): Promise<ActionResult> {
  const { data, error } = await query;
  if (error) return moderationError(error, context);
  return data && data.length > 0 ? { ok: true } : { ok: false, error: "forbidden" };
}

export async function setResourceStatus(id: string, status: Enums["resource_status"]) {
  const supabase = await createClient();
  return finish(supabase.from("resources").update({ status }).eq("id", id).select("id"), "resource status");
}

export async function setResourceLinkStatus(id: string, linkStatus: Enums["link_status"]) {
  const supabase = await createClient();
  return finish(
    supabase.from("resources").update({ link_status: linkStatus }).eq("id", id).select("id"),
    "link status",
  );
}

export async function setCommentStatus(id: string, status: Enums["comment_status"]) {
  const supabase = await createClient();
  return finish(supabase.from("comments").update({ status }).eq("id", id).select("id"), "comment status");
}

export async function setReportStatus(id: string, status: Enums["report_status"]) {
  const supabase = await createClient();
  return finish(supabase.from("reports").update({ status }).eq("id", id).select("id"), "report status");
}

export async function setRemovalRequestStatus(id: string, status: Enums["report_status"]) {
  const supabase = await createClient();
  return finish(supabase.from("removal_requests").update({ status }).eq("id", id).select("id"), "removal request");
}

export async function setUserBanned(id: string, banned: boolean) {
  const supabase = await createClient();
  return finish(supabase.from("profiles").update({ is_banned: banned }).eq("id", id).select("id"), "ban");
}

export async function setUserRole(id: string, role: Enums["user_role"]) {
  const supabase = await createClient();
  return finish(supabase.from("profiles").update({ role }).eq("id", id).select("id"), "role");
}

/**
 * A staff decision about a link (Havolalar page): sets its status and closes the open "Havola
 * ishlamayapti" reports about it (resolved when broken, dismissed when it works). A deleted resource's
 * reports can still be closed.
 */
export async function decideLinkStatus(resourceId: string, linkStatus: "ok" | "broken"): Promise<ActionResult> {
  const updated = await setResourceLinkStatus(resourceId, linkStatus);
  if (!updated.ok && updated.error !== "forbidden") return updated;

  const supabase = await createClient();
  const { data: closed, error } = await supabase
    .from("reports")
    .update({ status: linkStatus === "broken" ? "resolved" : "dismissed" })
    .eq("target_type", "broken_link")
    .eq("target_id", resourceId)
    .eq("status", "open")
    .select("id");
  if (error) return moderationError(error, "link reports");
  // Neither the resource nor a report changed: not staff, or nothing to decide.
  return updated.ok || closed.length > 0 ? { ok: true } : updated;
}

/**
 * "Confirm" a report: takes the reported content down (hides the resource or comment, bans the
 * user) and marks the report resolved, which also counts against the author's trust (D17).
 */
export async function resolveReportWithAction(reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select("target_type, target_id")
    .eq("id", reportId)
    .maybeSingle();
  if (error) return moderationError(error, "report lookup");
  if (!report) return { ok: false, error: "notFound" };

  const taken =
    report.target_type === "resource" || report.target_type === "broken_link"
      ? await setResourceStatus(report.target_id, "hidden")
      : report.target_type === "comment"
        ? await setCommentStatus(report.target_id, "hidden")
        : await setUserBanned(report.target_id, true);
  // The content may already be gone (deleted by its author); the report can still be closed.
  if (!taken.ok && taken.error !== "forbidden") return taken;

  return setReportStatus(reportId, "resolved");
}

// ---------------------------------------------------------------------------
// Topics and the domain blocklist (admins)
// ---------------------------------------------------------------------------

function topicRow(data: TopicData) {
  return { slug: data.slug, name_uz: data.nameUz, description_uz: data.descriptionUz, sort_order: data.sortOrder };
}

function topicError(error: DbError, context: string): ActionResult<keyof TopicInput> {
  if (error.code === "23505") return { ok: false, error: "invalidInput", fieldErrors: { slug: "topicSlugFormat" } };
  return moderationError(error, context);
}

export async function createTopic(data: TopicData): Promise<ActionResult<keyof TopicInput>> {
  const supabase = await createClient();
  const { error } = await supabase.from("topics").insert(topicRow(data));
  return error ? topicError(error, "topic insert") : { ok: true };
}

export async function updateTopic(id: string, data: TopicData): Promise<ActionResult<keyof TopicInput>> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("topics").update(topicRow(data)).eq("id", id).select("id");
  if (error) return topicError(error, "topic update");
  return rows.length > 0 ? { ok: true } : { ok: false, error: "forbidden" };
}

export async function deleteTopic(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("topics").delete().eq("id", id).select("id");
  // Resources still point at it (foreign key `on delete restrict`).
  if (error?.code === "23503") return { ok: false, error: "topicInUse" };
  if (error) return moderationError(error, "topic delete");
  return data.length > 0 ? { ok: true } : { ok: false, error: "forbidden" };
}

export async function addBlockedDomain(data: BlockedDomainData): Promise<ActionResult<"domain" | "reason">> {
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_domains").insert({ domain: data.domain, reason: data.reason });
  if (error?.code === "23505") return { ok: false, error: "domainExists" };
  return error ? moderationError(error, "domain insert") : { ok: true };
}

export async function removeBlockedDomain(domain: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blocked_domains").delete().eq("domain", domain).select("domain");
  if (error) return moderationError(error, "domain delete");
  return data.length > 0 ? { ok: true } : { ok: false, error: "forbidden" };
}

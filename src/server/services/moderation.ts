import "server-only";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { BlockedDomainData, BlockedTermData, SettingsData, TopicData, TopicInput } from "@/lib/validators";
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

function rpcError(error: DbError, context: string): ActionResult<never> {
  if (error.message === "reason_required") return { ok: false, error: "reasonRequired" };
  if (error.message === "evidence_not_preserved") return { ok: false, error: "evidenceNotPreserved" };
  if (error.code === "P0002") return { ok: false, error: "notFound" };
  if (error.code === "23505") return { ok: false, error: "alreadyRequested" };
  return moderationError(error, context);
}

/** Runs one moderation function (see 20261012090200_moderator_tools.sql) as the staff member. */
async function rpc(query: PromiseLike<{ error: DbError | null }>, context: string): Promise<ActionResult> {
  const { error } = await query;
  return error ? rpcError(error, context) : { ok: true };
}

export type Moderation = { reason: string; rule?: string | null };

export async function moderateResource(id: string, status: Enums["resource_status"], { reason, rule }: Moderation) {
  const supabase = await createClient();
  return rpc(
    supabase.rpc("moderate_resource", { resource_id: id, new_status: status, reason, rule: rule ?? undefined }),
    "resource status",
  );
}

export async function setResourceLinkStatus(id: string, linkStatus: Enums["link_status"]) {
  const supabase = await createClient();
  return finish(
    supabase.from("resources").update({ link_status: linkStatus }).eq("id", id).select("id"),
    "link status",
  );
}

export async function moderateComment(id: string, status: Enums["comment_status"], { reason, rule }: Moderation) {
  const supabase = await createClient();
  return rpc(
    supabase.rpc("moderate_comment", { comment_id: id, new_status: status, reason, rule: rule ?? undefined }),
    "comment status",
  );
}

/** Admins delete for good; content under a severe report only once its evidence is preserved. */
export async function deleteContent(targetType: "resource" | "comment", id: string, { reason }: Moderation) {
  const supabase = await createClient();
  return rpc(supabase.rpc("delete_content", { target_type: targetType, target_id: id, reason }), "delete content");
}

/** `days`: 1, 7 or 30; null for a permanent ban (admins); 0 lifts the ban. */
export async function banUser(id: string, days: number | null, { reason, rule }: Moderation) {
  const supabase = await createClient();
  return rpc(
    // The generated types cannot express a nullable argument; null means "permanent".
    supabase.rpc("set_user_ban", { user_id: id, ban_days: days as number, reason, rule: rule ?? undefined }),
    "ban",
  );
}

export async function warnUser(id: string, { reason, rule }: Moderation) {
  const supabase = await createClient();
  return rpc(supabase.rpc("warn_user", { user_id: id, reason, rule: rule ?? undefined }), "warning");
}

export async function setUserRole(id: string, role: Enums["user_role"], { reason }: Moderation) {
  const supabase = await createClient();
  return rpc(supabase.rpc("set_user_role", { user_id: id, new_role: role, reason }), "role");
}

/** `level` null gives the user back to the automatic rules. */
export async function setTrustLevel(id: string, level: number | null, { reason }: Moderation) {
  const supabase = await createClient();
  return rpc(supabase.rpc("set_trust_level", { user_id: id, level: level as number, reason }), "trust level");
}

export type ReportDecision = "take_down" | "resolve" | "dismiss";

/** Decides every open report about one item (see handle_reports). */
export async function handleReports(
  targetType: Exclude<Enums["report_target"], "broken_link">,
  targetId: string,
  decision: ReportDecision,
  { reason, rule }: Moderation,
) {
  const supabase = await createClient();
  return rpc(
    supabase.rpc("handle_reports", {
      target_type: targetType,
      target_id: targetId,
      decision,
      reason,
      rule: rule ?? undefined,
    }),
    "reports",
  );
}

export async function handleAppeal(id: string, accept: boolean, { reason }: Moderation) {
  const supabase = await createClient();
  return rpc(supabase.rpc("handle_appeal", { appeal_id: id, accept, response: reason }), "appeal");
}

export async function handleRemovalRequest(id: string, status: "resolved" | "dismissed", { reason }: Moderation) {
  const supabase = await createClient();
  return rpc(supabase.rpc("handle_removal_request", { request_id: id, new_status: status, reason }), "removal request");
}

export type PendingActionKind = "permanent_ban" | "delete_resource" | "delete_comment";

/** Moderators ask an admin to ban permanently or delete (two-step severe actions). */
export async function requestAction(kind: PendingActionKind, targetId: string, { reason }: Moderation) {
  const supabase = await createClient();
  return rpc(supabase.rpc("request_action", { kind, target_id: targetId, reason }), "request action");
}

export async function decidePendingAction(id: string, approve: boolean, note: string | null) {
  const supabase = await createClient();
  return rpc(
    supabase.rpc("decide_pending_action", { action_id: id, approve, note: note ?? undefined }),
    "decide action",
  );
}

export async function setSevereIncidentStatus(id: string, status: "preserved" | "closed", notes: string | null) {
  const supabase = await createClient();
  return finish(
    supabase.from("severe_incidents").update({ status, notes }).eq("id", id).select("id"),
    "severe incident",
  );
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
  const { error } = await supabase
    .from("blocked_domains")
    .insert({ domain: data.domain, reason: data.reason, category: data.category });
  if (error?.code === "23505") return { ok: false, error: "domainExists" };
  return error ? moderationError(error, "domain insert") : { ok: true };
}

export async function removeBlockedDomain(domain: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blocked_domains").delete().eq("domain", domain).select("domain");
  if (error) return moderationError(error, "domain delete");
  return data.length > 0 ? { ok: true } : { ok: false, error: "forbidden" };
}

export async function addBlockedTerm(data: BlockedTermData): Promise<ActionResult<"term" | "category">> {
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_terms").insert({ term: data.term, category: data.category });
  if (error?.code === "23505") return { ok: false, error: "termExists" };
  return error ? moderationError(error, "term insert") : { ok: true };
}

export async function removeBlockedTerm(term: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blocked_terms").delete().eq("term", term).select("term");
  if (error) return moderationError(error, "term delete");
  return data.length > 0 ? { ok: true } : { ok: false, error: "forbidden" };
}

export async function updateSettings(data: SettingsData): Promise<ActionResult<keyof SettingsData>> {
  const supabase = await createClient();
  const entries = Object.entries(data) as [keyof SettingsData, string | number][];
  for (const [key, value] of entries) {
    const { data: rows, error } = await supabase.from("app_settings").update({ value }).eq("key", key).select("key");
    if (error) return moderationError(error, "settings");
    if (rows.length === 0) return { ok: false, error: "forbidden" };
  }
  return { ok: true };
}

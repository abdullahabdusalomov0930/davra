import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/server/services/settings";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

// Read side of the moderation panel. Runs as the staff member (RLS lets staff see every resource,
// report, removal request and the audit log; regular users get nothing back).

const PAGE = 50;

async function count(query: PromiseLike<{ count: number | null; error: { code?: string } | null }>) {
  const { count: total, error } = await query;
  if (error) throw error;
  return total ?? 0;
}

type Client = Awaited<ReturnType<typeof createClient>>;

/** Resources on the Havolalar page: reported as not working, or marked broken by the checker. */
async function countLinkQueue(supabase: Client) {
  const [reported, broken] = await Promise.all([
    supabase.from("reports").select("target_id").eq("status", "open").eq("target_type", "broken_link").limit(1000),
    supabase.from("resources").select("id").eq("status", "published").eq("link_status", "broken").limit(1000),
  ]);
  if (reported.error) throw reported.error;
  if (broken.error) throw broken.error;
  return new Set([...reported.data.map((report) => report.target_id), ...broken.data.map((resource) => resource.id)])
    .size;
}

/** Numbers for the /admin overview. */
export async function getModerationCounts() {
  const supabase = await createClient();
  const [pending, pendingComments, reports, removals, brokenLinks, appeals, requests, severe] = await Promise.all([
    count(supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .neq("target_type", "broken_link"),
    ),
    count(supabase.from("removal_requests").select("id", { count: "exact", head: true }).eq("status", "open")),
    countLinkQueue(supabase),
    count(supabase.from("appeals").select("id", { count: "exact", head: true }).eq("status", "open")),
    count(supabase.from("pending_actions").select("id", { count: "exact", head: true }).eq("status", "pending")),
    // Admins only (RLS); moderators get 0.
    count(supabase.from("severe_incidents").select("id", { count: "exact", head: true }).eq("status", "open")),
  ]);
  return { pending, pendingComments, reports, removals, brokenLinks, appeals, requests, severe };
}

const QUEUE_COLUMNS = `
  id, slug, title, url, domain, final_url, reputation_status, moderation_state, type, summary, status, link_status,
  created_at, updated_at,
  topic:topics (slug, name_uz),
  author:profiles!resources_author_id_fkey (id, username, display_name, created_at, trust_level)
` as const;

export type AuthorRecord = { published: number; hidden: number; rejected: number; confirmedReports: number };

/** What each author has done so far, for the queues: published, hidden and rejected cards, confirmed reports. */
export async function listAuthorRecords(userIds: readonly string[]) {
  const records = new Map<string, AuthorRecord>();
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return records;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("author_records", { user_ids: ids });
  if (error) throw error;
  for (const row of data) {
    records.set(row.user_id, {
      published: row.published,
      hidden: row.hidden,
      rejected: row.rejected,
      confirmedReports: row.confirmed_reports,
    });
  }
  return records;
}

/** Resources in one moderation status, oldest first (the queue order). */
export async function listResourcesByStatus(status: Enums["resource_status"]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(QUEUE_COLUMNS)
    .eq("status", status)
    .order(status === "pending" ? "created_at" : "updated_at", { ascending: status === "pending" })
    .limit(PAGE);
  if (error) throw error;
  return data;
}

export type QueueResource = Awaited<ReturnType<typeof listResourcesByStatus>>[number];

/** Comments the safety check held, oldest first. */
export async function listPendingComments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      `id, body, created_at,
       resource:resources (slug, title),
       author:profiles!comments_author_id_fkey (username, display_name, created_at)`,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(PAGE);
  if (error) throw error;
  return data;
}

/** Why the safety check held these resources or comments (internal reason codes, latest check). */
export async function listHoldReasons(targetType: "resource" | "comment", ids: readonly string[]) {
  const reasons = new Map<string, string[]>();
  if (ids.length === 0) return reasons;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("moderation_events")
    .select("target_id, reasons")
    .eq("target_type", targetType)
    .eq("decision", "needs_review")
    .in("target_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  for (const event of data) {
    if (event.target_id && !reasons.has(event.target_id)) reasons.set(event.target_id, event.reasons);
  }
  return reasons;
}

const LINK_COLUMNS = "id, slug, title, url, link_status, link_check_failures, last_link_check_at" as const;

/**
 * The Havolalar page: links people reported as not working (one entry per resource, oldest report
 * first), then published links the checker marked broken that nobody reported.
 */
export async function listLinkQueue() {
  const supabase = await createClient();
  const [reports, broken] = await Promise.all([
    supabase
      .from("reports")
      .select("target_id, created_at")
      .eq("status", "open")
      .eq("target_type", "broken_link")
      .order("created_at", { ascending: true })
      .limit(PAGE * 4),
    supabase
      .from("resources")
      .select(LINK_COLUMNS)
      .eq("status", "published")
      .eq("link_status", "broken")
      .order("last_link_check_at", { ascending: false, nullsFirst: false })
      .limit(PAGE),
  ]);
  if (reports.error) throw reports.error;
  if (broken.error) throw broken.error;

  const reportCounts = new Map<string, number>();
  for (const { target_id } of reports.data) reportCounts.set(target_id, (reportCounts.get(target_id) ?? 0) + 1);
  const reportedIds = [...reportCounts.keys()].slice(0, PAGE);

  const { data: reportedResources, error } = reportedIds.length
    ? await supabase.from("resources").select(LINK_COLUMNS).in("id", reportedIds)
    : { data: [], error: null };
  if (error) throw error;
  const resourceById = new Map(reportedResources.map((resource) => [resource.id, resource]));

  return {
    reported: reportedIds.map((id) => ({
      id,
      reports: reportCounts.get(id) ?? 0,
      // null when the resource has been deleted since.
      resource: resourceById.get(id) ?? null,
    })),
    broken: broken.data.filter((resource) => !reportCounts.has(resource.id)),
  };
}

export type LinkQueueResource = Awaited<ReturnType<typeof listLinkQueue>>["broken"][number];

export type ReportPriority = "severe" | "hidden" | "urgent" | "normal";

const PRIORITY_ORDER: Record<ReportPriority, number> = { severe: 0, hidden: 1, urgent: 2, normal: 3 };
const URGENT_REASONS = new Set(["illegal", "scam_phishing"]);

/**
 * Open reports grouped by what they point at ("Havola ishlamayapti" reports are on the Havolalar
 * page), most urgent first: severe content, then items already hidden automatically, then reports of
 * illegal content or scams, then by total weight. Targets of different kinds live in different tables,
 * so they are loaded in one query per kind and attached by id.
 */
export async function listReportQueue() {
  const supabase = await createClient();
  const [{ data: reports, error }, settings] = await Promise.all([
    supabase
      .from("reports")
      .select(
        `id, target_type, target_id, reason, details, weight, created_at,
         reporter:profiles!reports_reporter_id_fkey (username, display_name),
         owner:profiles!reports_target_owner_id_fkey (id, username, display_name, trust_level)`,
      )
      .eq("status", "open")
      .neq("target_type", "broken_link")
      .order("created_at", { ascending: true })
      .limit(PAGE * 4),
    getSettings(),
  ]);
  if (error) throw error;

  const groups = new Map<
    string,
    { key: string; targetType: Enums["report_target"]; targetId: string; reports: typeof reports }
  >();
  for (const report of reports) {
    const key = `${report.target_type}:${report.target_id}`;
    const group = groups.get(key) ?? { key, targetType: report.target_type, targetId: report.target_id, reports: [] };
    group.reports.push(report);
    groups.set(key, group);
  }

  const idsOf = (type: Enums["report_target"]) =>
    [...groups.values()].filter((group) => group.targetType === type).map((group) => group.targetId);
  const resourceIds = idsOf("resource");
  const commentIds = idsOf("comment");
  const userIds = idsOf("user");

  const [resources, comments, users] = await Promise.all([
    resourceIds.length
      ? supabase
          .from("resources")
          .select("id, slug, title, status, url, domain, final_url, reputation_status, moderation_state")
          .in("id", resourceIds)
      : { data: [], error: null },
    commentIds.length
      ? supabase
          .from("comments")
          .select("id, body, status, moderation_state, resource:resources (slug, title)")
          .in("id", commentIds)
      : { data: [], error: null },
    userIds.length
      ? supabase.from("profiles").select("id, username, display_name, is_banned, trust_level").in("id", userIds)
      : { data: [], error: null },
  ]);
  if (resources.error) throw resources.error;
  if (comments.error) throw comments.error;
  if (users.error) throw users.error;

  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));
  const resourceMap = byId(resources.data);
  const commentMap = byId(comments.data);
  const userMap = byId(users.data);

  const queue = [...groups.values()].map((group) => {
    const resource = group.targetType === "resource" ? (resourceMap.get(group.targetId) ?? null) : null;
    const comment = group.targetType === "comment" ? (commentMap.get(group.targetId) ?? null) : null;
    const user = group.targetType === "user" ? (userMap.get(group.targetId) ?? null) : null;
    const weight = group.reports.reduce((sum, report) => sum + Number(report.weight), 0);
    const reasons = group.reports.map((report) => report.reason).filter((reason) => reason !== null);
    const urgent = reasons.some((reason) => URGENT_REASONS.has(reason));
    const state = resource?.moderation_state ?? comment?.moderation_state ?? null;
    const priority: ReportPriority = reasons.includes("severe")
      ? "severe"
      : state === "auto_hidden"
        ? "hidden"
        : urgent
          ? "urgent"
          : "normal";
    return {
      ...group,
      owner: group.reports[0]?.owner ?? null,
      resource,
      comment,
      user,
      weight,
      threshold: urgent ? settings.report_hide_threshold_urgent : settings.report_hide_threshold,
      priority,
    };
  });

  return queue
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        b.weight - a.weight ||
        a.reports[0].created_at.localeCompare(b.reports[0].created_at),
    )
    .slice(0, PAGE);
}

export type ReportGroup = Awaited<ReturnType<typeof listReportQueue>>[number];

export async function listRemovalRequests(status: Enums["report_status"] = "open") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("removal_requests")
    .select("id, resource_url, requester_name, requester_email, details, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(PAGE);
  if (error) throw error;
  return data;
}

export type RemovalRequest = Awaited<ReturnType<typeof listRemovalRequests>>[number];

/** Users, newest first, optionally matching a username or display name. */
export async function listUsers(search?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, role, is_banned, banned_until, trust_level, trust_level_manual, created_at")
    .order("created_at", { ascending: false })
    .limit(PAGE);
  // Characters with a meaning in PostgREST filters are dropped; the term is quoted.
  const term = search
    ?.trim()
    .replace(/[%_,()"\\]/g, "")
    .slice(0, 60);
  if (term) query = query.or(`username.ilike."%${term}%",display_name.ilike."%${term}%"`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export type AdminUser = Awaited<ReturnType<typeof listUsers>>[number];

/** Every topic with its number of resources in any status (a topic in use cannot be deleted). */
export async function listTopicsForAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, slug, name_uz, description_uz, sort_order, resources(count)")
    .order("sort_order")
    .order("name_uz");
  if (error) throw error;
  return data.map(({ resources, ...topic }) => ({ ...topic, resourceCount: resources[0]?.count ?? 0 }));
}

export type AdminTopic = Awaited<ReturnType<typeof listTopicsForAdmin>>[number];

export async function listBlockedDomains() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_domains")
    .select("domain, reason, category, created_at")
    .order("domain");
  if (error) throw error;
  return data;
}

/** Moderation actions, newest first, with who took them and why; `before` pages back in time. */
export async function listAuditLog(limit = 30, before?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select(
      "id, action, target_type, target_id, details, reason, created_at, actor:profiles!audit_log_actor_id_fkey (username, display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export type AuditEntry = Awaited<ReturnType<typeof listAuditLog>>[number];

/** Open appeals, oldest first, with what they are about and why it was decided. */
export async function listOpenAppeals() {
  const supabase = await createClient();
  const { data: appeals, error } = await supabase
    .from("appeals")
    .select(
      "id, target_type, target_id, message, created_at, user:profiles!appeals_user_id_fkey (id, username, display_name)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(PAGE);
  if (error) throw error;

  const ids = (type: string) =>
    appeals.filter((appeal) => appeal.target_type === type).map((appeal) => appeal.target_id);
  const [resources, comments, decisions] = await Promise.all([
    ids("resource").length
      ? supabase.from("resources").select("id, slug, title, status, summary").in("id", ids("resource"))
      : { data: [], error: null },
    ids("comment").length
      ? supabase.from("comments").select("id, body, status, resource:resources (slug)").in("id", ids("comment"))
      : { data: [], error: null },
    appeals.length
      ? supabase
          .from("audit_log")
          .select("target_id, reason, created_at")
          .in(
            "target_id",
            appeals.map((appeal) => appeal.target_id),
          )
          .not("reason", "is", null)
          .order("created_at", { ascending: false })
      : { data: [], error: null },
  ]);
  if (resources.error) throw resources.error;
  if (comments.error) throw comments.error;
  if (decisions.error) throw decisions.error;

  const resourceMap = new Map(resources.data.map((row) => [row.id, row]));
  const commentMap = new Map(comments.data.map((row) => [row.id, row]));
  const decisionMap = new Map<string, string>();
  for (const decision of decisions.data) {
    if (decision.reason && !decisionMap.has(decision.target_id)) decisionMap.set(decision.target_id, decision.reason);
  }

  return appeals.map((appeal) => ({
    ...appeal,
    resource: appeal.target_type === "resource" ? (resourceMap.get(appeal.target_id) ?? null) : null,
    comment: appeal.target_type === "comment" ? (commentMap.get(appeal.target_id) ?? null) : null,
    decision: decisionMap.get(appeal.target_id) ?? null,
  }));
}

export type AdminAppeal = Awaited<ReturnType<typeof listOpenAppeals>>[number];

/** Permanent bans and deletions moderators asked for, waiting for an admin. */
export async function listPendingActions() {
  const supabase = await createClient();
  const { data: actions, error } = await supabase
    .from("pending_actions")
    .select(
      "id, kind, target_id, reason, created_at, requester:profiles!pending_actions_requested_by_fkey (username, display_name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(PAGE);
  if (error) throw error;

  const ids = (kind: string) => actions.filter((action) => action.kind === kind).map((action) => action.target_id);
  const [users, resources, comments] = await Promise.all([
    ids("permanent_ban").length
      ? supabase.from("profiles").select("id, username, display_name").in("id", ids("permanent_ban"))
      : { data: [], error: null },
    ids("delete_resource").length
      ? supabase.from("resources").select("id, slug, title").in("id", ids("delete_resource"))
      : { data: [], error: null },
    ids("delete_comment").length
      ? supabase.from("comments").select("id, body").in("id", ids("delete_comment"))
      : { data: [], error: null },
  ]);
  if (users.error) throw users.error;
  if (resources.error) throw resources.error;
  if (comments.error) throw comments.error;

  const userMap = new Map(users.data.map((row) => [row.id, row]));
  const resourceMap = new Map(resources.data.map((row) => [row.id, row]));
  const commentMap = new Map(comments.data.map((row) => [row.id, row]));
  return actions.map((action) => ({
    ...action,
    user: userMap.get(action.target_id) ?? null,
    resource: resourceMap.get(action.target_id) ?? null,
    comment: commentMap.get(action.target_id) ?? null,
  }));
}

export type PendingAction = Awaited<ReturnType<typeof listPendingActions>>[number];

/** Severe incidents (admins only; RLS gives moderators nothing). */
export async function listSevereIncidents(status: "open" | "preserved" | "closed" = "open") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("severe_incidents")
    .select(
      "id, target_type, target_id, author_id, snapshot, reports, content_created_at, first_reported_at, status, notes",
    )
    .eq("status", status)
    .order("first_reported_at", { ascending: true })
    .limit(PAGE);
  if (error) throw error;
  return data;
}

export type SevereIncident = Awaited<ReturnType<typeof listSevereIncidents>>[number];

export async function listBlockedTerms() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blocked_terms").select("term, category, created_at").order("term");
  if (error) throw error;
  return data;
}

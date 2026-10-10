import "server-only";

import { createClient } from "@/lib/supabase/server";
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
  const [pending, reports, removals, brokenLinks] = await Promise.all([
    count(supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .neq("target_type", "broken_link"),
    ),
    count(supabase.from("removal_requests").select("id", { count: "exact", head: true }).eq("status", "open")),
    countLinkQueue(supabase),
  ]);
  return { pending, reports, removals, brokenLinks };
}

const QUEUE_COLUMNS = `
  id, slug, title, url, domain, type, summary, status, link_status, created_at, updated_at,
  topic:topics (slug, name_uz),
  author:profiles!resources_author_id_fkey (username, display_name, avatar_url, created_at)
` as const;

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

/**
 * Open reports with what they point at ("Havola ishlamayapti" reports are on the Havolalar page).
 * Targets of different kinds live in different tables, so they are loaded in one query per kind and
 * attached by id.
 */
export async function listOpenReports() {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("reports")
    .select(
      `id, target_type, target_id, reason, details, created_at,
       reporter:profiles!reports_reporter_id_fkey (username, display_name),
       owner:profiles!reports_target_owner_id_fkey (username, display_name)`,
    )
    .eq("status", "open")
    .neq("target_type", "broken_link")
    .order("created_at", { ascending: true })
    .limit(PAGE);
  if (error) throw error;

  const idsOf = (...types: Enums["report_target"][]) => [
    ...new Set(reports.filter((report) => types.includes(report.target_type)).map((report) => report.target_id)),
  ];
  const resourceIds = idsOf("resource");
  const commentIds = idsOf("comment");
  const userIds = idsOf("user");

  const [resources, comments, users] = await Promise.all([
    resourceIds.length
      ? supabase.from("resources").select("id, slug, title, status, url").in("id", resourceIds)
      : { data: [], error: null },
    commentIds.length
      ? supabase.from("comments").select("id, body, status, resource:resources (slug, title)").in("id", commentIds)
      : { data: [], error: null },
    userIds.length
      ? supabase.from("profiles").select("id, username, display_name, is_banned").in("id", userIds)
      : { data: [], error: null },
  ]);
  if (resources.error) throw resources.error;
  if (comments.error) throw comments.error;
  if (users.error) throw users.error;

  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));
  const resourceMap = byId(resources.data);
  const commentMap = byId(comments.data);
  const userMap = byId(users.data);

  return reports.map((report) => ({
    ...report,
    resource: report.target_type === "resource" ? (resourceMap.get(report.target_id) ?? null) : null,
    comment: report.target_type === "comment" ? (commentMap.get(report.target_id) ?? null) : null,
    user: report.target_type === "user" ? (userMap.get(report.target_id) ?? null) : null,
  }));
}

export type OpenReport = Awaited<ReturnType<typeof listOpenReports>>[number];

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
    .select("id, username, display_name, avatar_url, role, is_banned, created_at")
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
  const { data, error } = await supabase.from("blocked_domains").select("domain, reason, created_at").order("domain");
  if (error) throw error;
  return data;
}

/** The most recent moderation actions with who took them. */
export async function listAuditLog(limit = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, action, target_type, target_id, details, created_at, actor:profiles!audit_log_actor_id_fkey (username, display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type AuditEntry = Awaited<ReturnType<typeof listAuditLog>>[number];

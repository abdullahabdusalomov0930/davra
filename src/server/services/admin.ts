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

/** Numbers for the /admin overview. */
export async function getModerationCounts() {
  const supabase = await createClient();
  const [pending, reports, removals, brokenLinks, brokenReports] = await Promise.all([
    count(supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .neq("target_type", "broken_link"),
    ),
    count(supabase.from("removal_requests").select("id", { count: "exact", head: true }).eq("status", "open")),
    count(
      supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .eq("link_status", "broken"),
    ),
    count(
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("target_type", "broken_link"),
    ),
  ]);
  return { pending, reports, removals, brokenLinks: brokenLinks + brokenReports };
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

/** Published resources whose link the checker marked broken (Phase 8 fills this in). */
export async function listBrokenLinkResources() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(QUEUE_COLUMNS)
    .eq("status", "published")
    .eq("link_status", "broken")
    .order("updated_at", { ascending: false })
    .limit(PAGE);
  if (error) throw error;
  return data;
}

/**
 * Open reports with what they point at. Targets of different kinds live in different tables, so
 * they are loaded in one query per kind and attached by id.
 */
export async function listOpenReports({ brokenLinks = false }: { brokenLinks?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("reports")
    .select(
      `id, target_type, target_id, reason, details, created_at,
       reporter:profiles!reports_reporter_id_fkey (username, display_name),
       owner:profiles!reports_target_owner_id_fkey (username, display_name)`,
    )
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(PAGE);
  query = brokenLinks ? query.eq("target_type", "broken_link") : query.neq("target_type", "broken_link");
  const { data: reports, error } = await query;
  if (error) throw error;

  const idsOf = (...types: Enums["report_target"][]) => [
    ...new Set(reports.filter((report) => types.includes(report.target_type)).map((report) => report.target_id)),
  ];
  const resourceIds = idsOf("resource", "broken_link");
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
    resource:
      report.target_type === "resource" || report.target_type === "broken_link"
        ? (resourceMap.get(report.target_id) ?? null)
        : null,
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

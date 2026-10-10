import "server-only";

import { cache } from "react";

import type { ActionResult } from "@/lib/action-result";
import { slugify, withSuffix } from "@/lib/slugify";
import { createClient } from "@/lib/supabase/server";
import { urlTwins } from "@/lib/url-normalize";
import type { ResourceData, ResourceInput } from "@/lib/validators";
import { createAdminClient } from "@/server/supabase/admin";

import { type DbError, rateLimitError } from "./db-errors";
import type { Database } from "@/types/database";

export type ResourceStatus = Database["public"]["Enums"]["resource_status"];

/** Columns a resource card needs, with the topic and the author embedded. */
export const CARD_COLUMNS = `
  id, slug, author_id, title, url, domain, type, language, price, level, summary, status, link_status,
  likes_count, saves_count, comments_count, ratings_count, ratings_sum, published_at, created_at,
  topic:topics (slug, name_uz),
  author:profiles!resources_author_id_fkey (username, display_name, avatar_url)
` as const;

const DETAIL_COLUMNS = `${CARD_COLUMNS}, topic_id, for_whom, author_review, updated_at` as const;

/** A resource the current visitor may see (RLS: published, or their own, or staff), or null. */
export const getResourceBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("resources").select(DETAIL_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
});

export type ResourceDetail = NonNullable<Awaited<ReturnType<typeof getResourceBySlug>>>;

/** A user's resources, newest first. Others see the published ones; the author also sees the rest. */
export async function listResourcesByAuthor(authorId: string, limit = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(CARD_COLUMNS)
    .eq("author_id", authorId)
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type ResourceCardData = Awaited<ReturnType<typeof listResourcesByAuthor>>[number];

/**
 * The twins travel in the request's query string; past this length only the exact URL is checked,
 * so the request stays well below proxy URL limits. Such long links are rarely shared twice.
 */
const TWIN_CHECK_MAX_URL_LENGTH = 500;

/**
 * Looks for a resource with the same link (also with/without "www.", http/https and a trailing
 * slash). Uses the secret key because the existing card may be pending or hidden; only its slug is
 * returned, and only when the visitor may open it (published, or their own).
 */
export async function findDuplicate(url: string, viewerId: string, excludeId?: string) {
  const candidates = url.length <= TWIN_CHECK_MAX_URL_LENGTH ? urlTwins(url) : [url];
  let query = createAdminClient()
    .from("resources")
    .select("id, slug, status, author_id")
    .in("url", candidates)
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { slug: data.status === "published" || data.author_id === viewerId ? data.slug : undefined };
}

type ResourceResult = ActionResult<keyof ResourceInput, { slug: string; status: ResourceStatus }>;

/**
 * The unique constraint only catches the exact URL; this also catches its twins (`urlTwins`). Checked
 * before writing so the author learns about the existing card instead of creating a second one.
 */
async function duplicateError(url: string, viewerId: string, excludeId?: string): Promise<ResourceResult | null> {
  const duplicate = await findDuplicate(url, viewerId, excludeId);
  if (!duplicate) return null;
  return { ok: false, error: "invalidInput", fieldErrors: { url: "urlDuplicate" }, duplicateSlug: duplicate.slug };
}

/** Maps database errors to field errors; returns null for errors the caller handles itself. */
async function mapWriteError(error: DbError, url: string, viewerId: string, excludeId?: string) {
  if (error.code === "23505" && error.message.includes("resources_url_key")) {
    // Lost a race with another author who just shared the same link.
    return (
      (await duplicateError(url, viewerId, excludeId)) ??
      ({ ok: false, error: "invalidInput", fieldErrors: { url: "urlDuplicate" } } satisfies ResourceResult)
    );
  }
  if (error.code === "P0001" && error.message === "blocked_domain") {
    return { ok: false, error: "invalidInput", fieldErrors: { url: "urlBlocked" } } satisfies ResourceResult;
  }
  if (error.code === "23503") {
    return { ok: false, error: "invalidInput", fieldErrors: { topicId: "topicRequired" } } satisfies ResourceResult;
  }
  if (error.code === "42501") return { ok: false, error: "forbidden" } satisfies ResourceResult;
  const limited = rateLimitError(error);
  if (limited) return { ok: false, error: limited } satisfies ResourceResult;
  return null;
}

function toRow(data: ResourceData) {
  return {
    url: data.url,
    title: data.title,
    topic_id: data.topicId,
    type: data.type,
    language: data.language,
    price: data.price,
    level: data.level,
    summary: data.summary,
    for_whom: data.forWhom,
    author_review: data.authorReview,
  };
}

/**
 * Creates a card as the signed-in user. The database decides the status (pending until the author
 * is trusted) and rejects blocked domains and duplicates. A taken slug gets a short suffix.
 */
export async function createResource(viewerId: string, data: ResourceData): Promise<ResourceResult> {
  const duplicate = await duplicateError(data.url, viewerId);
  if (duplicate) return duplicate;

  const supabase = await createClient();
  const base = slugify(data.title);

  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0 ? base : withSuffix(base);
    const { data: row, error } = await supabase
      .from("resources")
      .insert({ ...toRow(data), slug })
      .select("slug, status")
      .single();

    if (!error) return { ok: true, slug: row.slug, status: row.status };
    if (error.code === "23505" && error.message.includes("resources_slug_key")) continue;

    const mapped = await mapWriteError(error, data.url, viewerId);
    if (mapped) return mapped;
    console.error("createResource failed", { code: error.code });
    return { ok: false, error: "unknown" };
  }
  return { ok: false, error: "unknown" };
}

/** Updates the author's own card. A new URL sends it back to the queue unless the author is trusted. */
export async function updateResource(viewerId: string, id: string, data: ResourceData): Promise<ResourceResult> {
  const duplicate = await duplicateError(data.url, viewerId, id);
  if (duplicate) return duplicate;

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("resources")
    .update(toRow(data))
    .eq("id", id)
    .eq("author_id", viewerId)
    .select("slug, status")
    .maybeSingle();

  if (error) {
    const mapped = await mapWriteError(error, data.url, viewerId, id);
    if (mapped) return mapped;
    console.error("updateResource failed", { code: error.code });
    return { ok: false, error: "unknown" };
  }
  // No row: not the author's card, or the author is banned (RLS).
  if (!row) return { ok: false, error: "forbidden" };
  return { ok: true, slug: row.slug, status: row.status };
}

export async function deleteResource(viewerId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .delete()
    .eq("id", id)
    .eq("author_id", viewerId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteResource failed", { code: error.code });
    return { ok: false, error: "unknown" };
  }
  if (!data) return { ok: false, error: "forbidden" };
  return { ok: true };
}

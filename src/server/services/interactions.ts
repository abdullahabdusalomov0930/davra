import "server-only";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { CommentData, CommentInput, RatingData, RatingInput } from "@/lib/validators";
import { screenSubmission } from "@/server/safety/screen";

import { type DbError, rateLimitError } from "./db-errors";

/** Insert/delete failures that RLS, constraints and rate limits explain; anything else is unexpected. */
function writeError(error: DbError, context: string): Extract<ActionResult, { ok: false }> {
  const limited = rateLimitError(error);
  if (limited) return { ok: false, error: limited };
  // RLS: own resource, not published (any more), or a banned account.
  if (error.code === "42501") return { ok: false, error: "forbidden" };
  // The resource was deleted meanwhile.
  if (error.code === "23503") return { ok: false, error: "notFound" };
  console.error(`${context} failed`, { code: error.code });
  return { ok: false, error: "unknown" };
}

/** Which of these resources the signed-in user has liked and saved (both are private, D21). */
export async function getViewerInteractions(resourceIds: readonly string[]) {
  const empty = { liked: new Set<string>(), saved: new Set<string>() };
  if (resourceIds.length === 0) return empty;

  const supabase = await createClient();
  const [likes, saves] = await Promise.all([
    supabase.from("resource_likes").select("resource_id").in("resource_id", resourceIds),
    supabase.from("resource_saves").select("resource_id").in("resource_id", resourceIds),
  ]);
  if (likes.error) throw likes.error;
  if (saves.error) throw saves.error;
  return {
    liked: new Set(likes.data.map((row) => row.resource_id)),
    saved: new Set(saves.data.map((row) => row.resource_id)),
  };
}

export type ViewerInteractions = Awaited<ReturnType<typeof getViewerInteractions>>;

/**
 * Adds or removes a like or a save. Idempotent: liking twice or removing a missing like is fine.
 * Counters and the popularity score follow through database triggers.
 */
export async function setInteraction(
  table: "resource_likes" | "resource_saves",
  viewerId: string,
  resourceId: string,
  active: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();

  if (active) {
    const { error } = await supabase.from(table).insert({ resource_id: resourceId });
    if (!error || error.code === "23505") return { ok: true };
    return writeError(error, `${table} insert`);
  }

  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("user_id", viewerId)
    .eq("resource_id", resourceId)
    .select("resource_id");
  if (error) return writeError(error, `${table} delete`);
  if (data.length > 0) return { ok: true };

  // Nothing deleted: either there was nothing to remove, or RLS refused (banned account).
  const { count } = await supabase
    .from(table)
    .select("resource_id", { count: "exact", head: true })
    .eq("user_id", viewerId)
    .eq("resource_id", resourceId);
  return count ? { ok: false, error: "forbidden" } : { ok: true };
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/** The signed-in user's rating of a resource, or null. */
export async function getViewerRating(viewerId: string, resourceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resource_ratings")
    .select("stars, review_text, counts_in_average")
    .eq("user_id", viewerId)
    .eq("resource_id", resourceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates or replaces the user's rating. A written review passes the safety check first (D64). */
export async function saveRating(
  viewerId: string,
  resourceId: string,
  data: RatingData,
): Promise<ActionResult<keyof RatingInput>> {
  if (data.reviewText) {
    const screening = await screenSubmission(viewerId, { kind: "rating", resourceId, reviewText: data.reviewText });
    if (!screening.ok) return { ok: false, error: "invalidInput", fieldErrors: screening.fieldErrors };
  }
  return writeRating(viewerId, resourceId, data);
}

/**
 * Update first, then insert: an upsert would need UPDATE on resource_id, which users do not have
 * (column privileges, D14).
 */
async function writeRating(
  viewerId: string,
  resourceId: string,
  data: RatingData,
  retried = false,
): Promise<ActionResult<keyof RatingInput>> {
  const supabase = await createClient();
  const values = { stars: data.stars, review_text: data.reviewText };

  const updated = await supabase
    .from("resource_ratings")
    .update(values)
    .eq("user_id", viewerId)
    .eq("resource_id", resourceId)
    .select("resource_id");
  if (updated.error) return writeError(updated.error, "rating update");
  if (updated.data.length > 0) return { ok: true };

  const inserted = await supabase.from("resource_ratings").insert({ resource_id: resourceId, ...values });
  // A parallel request inserted first: try the update once more.
  if (inserted.error?.code === "23505" && !retried) return writeRating(viewerId, resourceId, data, true);
  if (inserted.error) return writeError(inserted.error, "rating insert");
  return { ok: true };
}

export async function deleteRating(viewerId: string, resourceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resource_ratings")
    .delete()
    .eq("user_id", viewerId)
    .eq("resource_id", resourceId)
    .select("resource_id");
  if (error) return writeError(error, "rating delete");
  return data.length > 0 ? { ok: true } : { ok: false, error: "forbidden" };
}

/** Ratings that come with a written review, newest first. */
export async function listReviews(resourceId: string, limit = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resource_ratings")
    .select(
      "user_id, stars, review_text, created_at, updated_at, author:profiles!resource_ratings_user_id_fkey (username, display_name)",
    )
    .eq("resource_id", resourceId)
    .not("review_text", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type Review = Awaited<ReturnType<typeof listReviews>>[number];

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/** Comments in the order they were written. Authors also see their own hidden comments (RLS). */
export async function listComments(resourceId: string, limit = 200) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, author_id, body, status, created_at, author:profiles!comments_author_id_fkey (username, display_name)")
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type Comment = Awaited<ReturnType<typeof listComments>>[number];

/**
 * Adds a comment after the safety check (D64). A comment the check holds is saved as pending: its
 * author sees it, everyone else after a moderator publishes it.
 */
export async function addComment(
  viewerId: string,
  resourceId: string,
  data: CommentData,
): Promise<ActionResult<keyof CommentInput, { pending: boolean }>> {
  const screening = await screenSubmission(viewerId, { kind: "comment", resourceId, body: data.body });
  if (!screening.ok) return { ok: false, error: "invalidInput", fieldErrors: screening.fieldErrors };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("comments")
    .insert({ resource_id: resourceId, body: data.body })
    .select("id, status")
    .single();
  if (error) return writeError(error, "comment insert");
  await screening.recordHeld(row.id);
  return { ok: true, pending: row.status === "pending" };
}

export async function deleteComment(viewerId: string, commentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", viewerId)
    .select("id");
  if (error) return writeError(error, "comment delete");
  return data.length > 0 ? { ok: true } : { ok: false, error: "forbidden" };
}

import "server-only";

import { decodeCursor, encodeCursor } from "@/lib/feed-cursor";
import { createClient } from "@/lib/supabase/server";

import { FEED_PAGE_SIZE, type FeedPage } from "./feed";
import { CARD_COLUMNS } from "./resources";

/**
 * "Saqlanganlar": the user's saved resources, most recently saved first, optionally on one topic.
 * Saves are private (RLS shows only the user's own); a saved card that was hidden since drops out
 * through the inner join. The cursor reuses the feed format: p = saved at, i = resource id.
 */
export async function findSavedResources(
  viewerId: string,
  { topicId, cursor, pageSize = FEED_PAGE_SIZE }: { topicId?: string; cursor?: string | null; pageSize?: number } = {},
): Promise<FeedPage> {
  const supabase = await createClient();
  let query = supabase
    .from("resource_saves")
    .select(`created_at, resource_id, resource:resources!inner (${CARD_COLUMNS})`)
    .eq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .order("resource_id", { ascending: false })
    .limit(pageSize + 1);

  if (topicId) query = query.eq("resource.topic_id", topicId);
  const after = decodeCursor(cursor);
  if (after?.p && after.i) {
    query = query.or(`created_at.lt."${after.p}",and(created_at.eq."${after.p}",resource_id.lt.${after.i})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data.slice(0, pageSize);
  const last = rows.at(-1);
  return {
    items: rows.map((row) => row.resource),
    nextCursor: data.length > pageSize && last ? encodeCursor({ p: last.created_at, i: last.resource_id }) : null,
  };
}

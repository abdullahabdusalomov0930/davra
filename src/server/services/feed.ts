import "server-only";

import { decodeCursor, encodeCursor } from "@/lib/feed-cursor";
import { createClient } from "@/lib/supabase/server";
import { hasCyrillic, toLatin } from "@/lib/transliterate";
import type { FeedQuery } from "@/lib/validators";

import { CARD_COLUMNS, type ResourceCardData } from "./resources";

export const FEED_PAGE_SIZE = 18;

export type FeedPage = { items: ResourceCardData[]; nextCursor: string | null };

/**
 * One page of published resources: the feed, topic pages, related resources and search all use
 * this. `search_resources` decides which cards and in what order (and runs as the visitor, so RLS
 * applies); the cards themselves are then loaded by id with their topic and author.
 */
export async function findResources(
  query: FeedQuery,
  { cursor, pageSize = FEED_PAGE_SIZE }: { cursor?: string | null; pageSize?: number } = {},
): Promise<FeedPage> {
  const supabase = await createClient();
  const text = query.text?.trim() || undefined;

  // One row more than asked for tells whether another page exists.
  const { data: rows, error } = await supabase.rpc("search_resources", {
    search_text: text,
    // Cards are mostly written in Latin; a Cyrillic query also looks for its Latin spelling.
    alt_search_text: text && hasCyrillic(text) ? toLatin(text) : undefined,
    topic_id: query.topicId,
    resource_type: query.type,
    resource_language: query.language,
    resource_price: query.price,
    resource_level: query.level,
    sort_by: query.sort,
    after_cursor: decodeCursor(cursor) ?? undefined,
    page_size: pageSize + 1,
    following_only: query.following,
  });
  if (error) throw error;

  const pageRows = rows.slice(0, pageSize);
  if (pageRows.length === 0) return { items: [], nextCursor: null };

  const { data: cards, error: cardsError } = await supabase
    .from("resources")
    .select(CARD_COLUMNS)
    .in(
      "id",
      pageRows.map((row) => row.id),
    );
  if (cardsError) throw cardsError;

  const byId = new Map(cards.map((card) => [card.id, card]));
  const items = pageRows.flatMap((row) => byId.get(row.id) ?? []);
  const nextCursor = rows.length > pageSize ? encodeCursor(pageRows[pageRows.length - 1].next_cursor) : null;
  return { items, nextCursor };
}

/** Other popular resources on the same topic, for the bottom of a resource page. */
export async function findRelatedResources(resource: { id: string; topic_id: string }, limit = 4) {
  const { items } = await findResources({ topicId: resource.topic_id, sort: "popular" }, { pageSize: limit + 1 });
  return items.filter((item) => item.id !== resource.id).slice(0, limit);
}

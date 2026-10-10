import "server-only";

import { createClient } from "@/lib/supabase/server";

import { CARD_COLUMNS, type ResourceCardData } from "./resources";

export const WEEKLY_TOP_SIZE = 10;

export type WeeklyEntry = {
  resource: ResourceCardData;
  /** Activity in the last 7 days. */
  likes: number;
  saves: number;
  ratings: number;
};

/**
 * "Haftalik Top 10": `weekly_top_resources` ranks last week's activity (D60); the cards are then loaded
 * by id, as in the feed.
 */
export async function getWeeklyTop(): Promise<WeeklyEntry[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("weekly_top_resources", { max_count: WEEKLY_TOP_SIZE });
  if (error) throw error;
  if (rows.length === 0) return [];

  const { data: cards, error: cardsError } = await supabase
    .from("resources")
    .select(CARD_COLUMNS)
    .in(
      "id",
      rows.map((row) => row.resource_id),
    );
  if (cardsError) throw cardsError;

  const byId = new Map(cards.map((card) => [card.id, card]));
  return rows.flatMap((row) => {
    const resource = byId.get(row.resource_id);
    return resource ? [{ resource, likes: row.week_likes, saves: row.week_saves, ratings: row.week_ratings }] : [];
  });
}

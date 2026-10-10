"use server";

import { z } from "zod";

import { type CardEntry, toCardEntries } from "@/components/feed/card-entries";
import { decodeCursor } from "@/lib/feed-cursor";
import { feedQuerySchema } from "@/lib/validators";
import { findResources } from "@/server/services/feed";

const cursorSchema = z.string().max(300);

export type MoreResources = { cards: CardEntry[]; nextCursor: string | null };

/**
 * "Yana koʻrsatish": the next page of a resource list, as server-rendered cards. Read-only; RLS
 * decides what is visible.
 */
export async function loadMoreResourcesAction(query: unknown, cursor: unknown): Promise<MoreResources> {
  const parsedQuery = feedQuerySchema.safeParse(query);
  const parsedCursor = cursorSchema.safeParse(cursor);
  // A broken cursor ends the list instead of starting it again from the top.
  if (!parsedQuery.success || !parsedCursor.success || !decodeCursor(parsedCursor.data)) {
    return { cards: [], nextCursor: null };
  }

  const page = await findResources(parsedQuery.data, { cursor: parsedCursor.data });
  return { cards: toCardEntries(page.items), nextCursor: page.nextCursor };
}

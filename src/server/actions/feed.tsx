"use server";

import { z } from "zod";

import { type CardEntry, renderCardEntries } from "@/components/feed/card-entries";
import { decodeCursor } from "@/lib/feed-cursor";
import { feedQuerySchema } from "@/lib/validators";
import { getViewer } from "@/server/auth/session";
import { findResources } from "@/server/services/feed";
import { findSavedResources } from "@/server/services/saved";

const cursorSchema = z.string().max(300);
const topicIdSchema = z.uuid().optional();

export type MoreResources = { cards: CardEntry[]; nextCursor: string | null };

const END: MoreResources = { cards: [], nextCursor: null };

/** A cursor we issued, or null; a broken one ends the list instead of starting it again. */
function validCursor(cursor: unknown): string | null {
  const parsed = cursorSchema.safeParse(cursor);
  return parsed.success && decodeCursor(parsed.data) ? parsed.data : null;
}

/**
 * "Yana koʻrsatish" on the feed, topic pages and search: the next page as server-rendered cards.
 * Pages bind the query (`loadMoreResourcesAction.bind(null, query)`); bound values come from the
 * browser, so they are validated again. Read-only; RLS decides what is visible.
 */
export async function loadMoreResourcesAction(query: unknown, cursor: unknown): Promise<MoreResources> {
  const parsedQuery = feedQuerySchema.safeParse(query);
  const after = validCursor(cursor);
  if (!parsedQuery.success || !after) return END;

  const page = await findResources(parsedQuery.data, { cursor: after });
  return { cards: await renderCardEntries(page.items), nextCursor: page.nextCursor };
}

/** "Yana koʻrsatish" on /saqlanganlar. */
export async function loadMoreSavedAction(topicId: unknown, cursor: unknown): Promise<MoreResources> {
  const viewer = await getViewer();
  const parsedTopic = topicIdSchema.safeParse(topicId ?? undefined);
  const after = validCursor(cursor);
  if (!viewer || !parsedTopic.success || !after) return END;

  const page = await findSavedResources(viewer.id, { topicId: parsedTopic.data, cursor: after });
  return { cards: await renderCardEntries(page.items), nextCursor: page.nextCursor };
}

import "server-only";

import type { ReactNode } from "react";

import type { ResourceViewer } from "@/components/resources/resource-actions";
import { ResourceCard } from "@/components/resources/resource-card";
import { getViewer } from "@/server/auth/session";
import { getViewerInteractions } from "@/server/services/interactions";
import type { ResourceCardData } from "@/server/services/resources";

export type CardEntry = { id: string; card: ReactNode };

/**
 * Cards rendered on the server, with the visitor's like and save state, ready to hand to
 * ResourceList or to return from "load more". Server rendering keeps dates and numbers formatted
 * with the server's Uzbek locale data, which not every browser has (D48).
 */
export async function renderCardEntries(
  items: readonly ResourceCardData[],
  { hideAuthor = false }: { hideAuthor?: boolean } = {},
): Promise<CardEntry[]> {
  const viewer = await getViewer();
  const { liked, saved } = viewer
    ? await getViewerInteractions(items.map((item) => item.id))
    : { liked: new Set<string>(), saved: new Set<string>() };

  return items.map((item) => {
    const state: ResourceViewer = !viewer
      ? { kind: "guest" }
      : item.author_id === viewer.id
        ? { kind: "author" }
        : { kind: "member", liked: liked.has(item.id), saved: saved.has(item.id) };
    return { id: item.id, card: <ResourceCard resource={item} viewer={state} hideAuthor={hideAuthor} /> };
  });
}

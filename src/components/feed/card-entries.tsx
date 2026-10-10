import type { ReactNode } from "react";

import { ResourceCard } from "@/components/resources/resource-card";
import type { ResourceCardData } from "@/server/services/resources";

export type CardEntry = { id: string; card: ReactNode };

/**
 * Cards rendered on the server (dates and numbers formatted with the server's Uzbek locale data,
 * which not every browser has), ready to hand to ResourceList or to return from "load more".
 */
export function toCardEntries(items: readonly ResourceCardData[]): CardEntry[] {
  return items.map((item) => ({ id: item.id, card: <ResourceCard resource={item} /> }));
}

"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type MouseEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SEARCH_PARAMS } from "@/lib/validators";
import type { MoreResources } from "@/server/actions/feed";

import type { CardEntry } from "./card-entries";

type ResourceListProps = {
  /** The first page, rendered on the server (see renderCardEntries). */
  initialCards: CardEntry[];
  initialCursor: string | null;
  /** A Server Action bound to this list's query, e.g. `loadMoreResourcesAction.bind(null, query)`. */
  loadMore: (cursor: string) => Promise<MoreResources>;
  /**
   * This page's URL without a cursor. "Yana koʻrsatish" links to it with the cursor added, so the
   * button also works without JavaScript and crawlers can follow it.
   */
  baseHref: string;
};

/** A grid of resource cards with "Yana koʻrsatish" that appends the next page in place. */
export function ResourceList({ initialCards, initialCursor, loadMore, baseHref }: ResourceListProps) {
  const t = useTranslations("Feed");
  const [cards, setCards] = useState(initialCards);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, startTransition] = useTransition();

  const moreHref = cursor
    ? `${baseHref}${baseHref.includes("?") ? "&" : "?"}${SEARCH_PARAMS.cursor}=${encodeURIComponent(cursor)}`
    : undefined;

  function onLoadMore(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (!cursor || pending) return;

    startTransition(async () => {
      try {
        const page = await loadMore(cursor);
        setCards((current) => {
          // Scores can shift between requests; never show a card twice.
          const seen = new Set(current.map((entry) => entry.id));
          return [...current, ...page.cards.filter((entry) => !seen.has(entry.id))];
        });
        setCursor(page.nextCursor);
      } catch {
        toast.error(t("loadFailed"));
      }
    });
  }

  return (
    <div className="grid gap-8">
      <ul aria-label={t("listLabel")} aria-busy={pending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((entry) => (
          <li key={entry.id} className="grid">
            {entry.card}
          </li>
        ))}
      </ul>

      {moreHref && (
        <div className="flex justify-center">
          <Button asChild variant="outline" size="lg">
            <a href={moreHref} onClick={onLoadMore} aria-disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              {pending ? t("loadingMore") : t("loadMore")}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

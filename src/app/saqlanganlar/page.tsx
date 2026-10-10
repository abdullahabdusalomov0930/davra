import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { renderCardEntries } from "@/components/feed/card-entries";
import { ResourceList } from "@/components/feed/resource-list";
import { EmptyState } from "@/components/layout/empty-state";
import { TopicFilter } from "@/components/topics/topic-filter";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { SEARCH_PARAMS, toSearchQueryString } from "@/lib/validators";
import { loadMoreSavedAction } from "@/server/actions/feed";
import { requireViewer } from "@/server/auth/session";
import { findSavedResources } from "@/server/services/saved";
import { getTopics } from "@/server/services/topics";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Saved");
  return { title: t("title"), robots: { index: false } };
}

export default async function SavedPage({ searchParams }: PageProps<"/saqlanganlar">) {
  const viewer = await requireViewer(routes.saved);
  const params = await searchParams;
  const [t, topics] = await Promise.all([getTranslations("Saved"), getTopics()]);

  const topicSlug = firstParam(params[SEARCH_PARAMS.topic]);
  const topic = topicSlug ? topics.find((item) => item.slug === topicSlug) : undefined;
  const page = await findSavedResources(viewer.id, {
    topicId: topic?.id,
    cursor: firstParam(params[SEARCH_PARAMS.cursor]),
  });
  const baseHref = `${routes.saved}${toSearchQueryString({ topic: topic?.slug })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <TopicFilter
          topics={topics}
          value={topic?.slug}
          label={t("topic")}
          allLabel={t("allTopics")}
          applyLabel={t("apply")}
        />
      </header>

      {page.items.length > 0 ? (
        <ResourceList
          key={baseHref}
          initialCards={await renderCardEntries(page.items)}
          initialCursor={page.nextCursor}
          loadMore={loadMoreSavedAction.bind(null, topic?.id ?? null)}
          baseHref={baseHref}
        />
      ) : topic ? (
        <EmptyState title={t("emptyTopicTitle")} />
      ) : (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={{ href: routes.home, label: t("emptyCta") }}
        />
      )}
    </div>
  );
}

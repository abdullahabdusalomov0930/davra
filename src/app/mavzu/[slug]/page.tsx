import { ChevronLeftIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ListTabs } from "@/components/feed/list-tabs";
import { FollowButton } from "@/components/follow/follow-button";
import { renderCardEntries } from "@/components/feed/card-entries";
import { ResourceList } from "@/components/feed/resource-list";
import { EmptyState } from "@/components/layout/empty-state";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { metaDescription, openGraphBase } from "@/lib/seo";
import { isValidSlug } from "@/lib/slugify";
import { breadcrumbList } from "@/lib/structured-data";
import { type FeedQuery, SEARCH_PARAMS, SORT_PARAM_VALUES, toSearchQueryString } from "@/lib/validators";
import { loadMoreResourcesAction } from "@/server/actions/feed";
import { getViewer } from "@/server/auth/session";
import { findResources } from "@/server/services/feed";
import { isFollowing } from "@/server/services/follows";
import { getTopicBySlug } from "@/server/services/topics";

async function loadTopic(slug: string) {
  return isValidSlug(slug) ? getTopicBySlug(slug) : null;
}

export async function generateMetadata({ params }: PageProps<"/mavzu/[slug]">): Promise<Metadata> {
  const topic = await loadTopic((await params).slug);
  if (!topic) return {};

  const t = await getTranslations("Topics");
  const path = routes.topic(topic.slug);
  return {
    title: topic.name_uz,
    description: metaDescription(topic.description_uz ?? t("topicMetaDescription", { name: topic.name_uz })),
    alternates: { canonical: path },
    openGraph: { ...openGraphBase, type: "website", url: path },
  };
}

export default async function TopicPage({ params, searchParams }: PageProps<"/mavzu/[slug]">) {
  const topic = await loadTopic((await params).slug);
  if (!topic) notFound();

  const search = await searchParams;
  // "Eng yaxshilari" by default; until cards are rated it lists the newest first anyway.
  const sort = firstParam(search[SEARCH_PARAMS.sort]) === SORT_PARAM_VALUES.newest ? "newest" : "top";
  const query: FeedQuery = { topicId: topic.id, sort };
  const topicHref = routes.topic(topic.slug);
  const newestHref = `${topicHref}?${SEARCH_PARAMS.sort}=${SORT_PARAM_VALUES.newest}`;

  const [t, tNav, tFeed, page, viewer] = await Promise.all([
    getTranslations("Topics"),
    getTranslations("Nav"),
    getTranslations("Feed"),
    findResources(query, { cursor: firstParam(search[SEARCH_PARAMS.cursor]) }),
    getViewer(),
  ]);
  const following = viewer ? await isFollowing(viewer.id, { kind: "topic", id: topic.id }) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          ...breadcrumbList([
            { name: tNav("home"), path: routes.home },
            { name: tNav("topics"), path: routes.topics },
            { name: topic.name_uz, path: topicHref },
          ]),
        }}
      />
      <Link
        href={routes.topics}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {t("allTopics")}
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{topic.name_uz}</h1>
          {topic.description_uz && <p className="mt-2 text-muted-foreground">{topic.description_uz}</p>}
          <p className="mt-2 text-sm font-medium text-primary">{t("resourceCount", { count: topic.resourceCount })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`${routes.search}${toSearchQueryString({ topic: topic.slug })}`}>
              <SearchIcon aria-hidden />
              {t("searchInTopic")}
            </Link>
          </Button>
          <FollowButton
            target={{ kind: "topic", id: topic.id }}
            following={following}
            signInHref={routes.signInTo(topicHref)}
          />
        </div>
      </header>

      {/* Cards are h3; this keeps the heading outline in order for screen readers. */}
      <h2 className="sr-only">{tFeed("listLabel")}</h2>
      <div className="mb-5">
        <ListTabs
          label={tFeed("tabsLabel")}
          tabs={[
            { href: topicHref, label: tFeed("top"), active: sort === "top" },
            { href: newestHref, label: tFeed("newest"), active: sort === "newest" },
          ]}
        />
      </div>

      {page.items.length > 0 ? (
        <ResourceList
          key={sort}
          initialCards={await renderCardEntries(page.items)}
          initialCursor={page.nextCursor}
          loadMore={loadMoreResourcesAction.bind(null, query)}
          baseHref={sort === "newest" ? newestHref : topicHref}
        />
      ) : (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={{ href: routes.newResource, label: t("emptyCta") }}
        />
      )}
    </div>
  );
}

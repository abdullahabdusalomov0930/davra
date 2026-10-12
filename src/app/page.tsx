import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListTabs } from "@/components/feed/list-tabs";
import { CommunitySection, StatsSection, TopicsMarquee } from "@/components/home/closing-sections";
import { FeaturesSection } from "@/components/home/features-section";
import { Hero } from "@/components/home/hero";
import { ProblemSection } from "@/components/home/problem-section";
import { StepsSection, TrustRow } from "@/components/home/steps-section";
import { renderCardEntries } from "@/components/feed/card-entries";
import { ResourceList } from "@/components/feed/resource-list";
import { EmptyState } from "@/components/layout/empty-state";
import { JsonLd } from "@/components/seo/json-ld";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { absoluteUrl, openGraphBase } from "@/lib/seo";
import { APP_NAME } from "@/lib/config";
import { type FeedQuery, SEARCH_PARAMS, SORT_PARAM_VALUES } from "@/lib/validators";
import { getViewer } from "@/server/auth/session";
import { loadMoreResourcesAction } from "@/server/actions/feed";
import { findResources } from "@/server/services/feed";
import { getTopics } from "@/server/services/topics";

const NEWEST_HREF = routes.newest;

export async function generateMetadata(): Promise<Metadata> {
  // The "Yangi" tab and later pages are the same page for search engines.
  return {
    alternates: { canonical: routes.home },
    openGraph: { ...openGraphBase, type: "website", url: routes.home },
  };
}

/** Lets search engines show a search box for Davra (sitelinks search box). */
async function websiteData() {
  const t = await getTranslations("Metadata");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: absoluteUrl(routes.home),
    description: t("description"),
    inLanguage: "uz",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(routes.search)}?${SEARCH_PARAMS.query}={query}` },
      "query-input": "required name=query",
    },
  };
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  // "Mashhur" by default, so a first visit shows the best cards right away.
  const sort = firstParam(params[SEARCH_PARAMS.sort]) === SORT_PARAM_VALUES.newest ? "newest" : "popular";
  const query: FeedQuery = { sort };

  const [t, tFeed, viewer, page] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Feed"),
    getViewer(),
    findResources(query, { cursor: firstParam(params[SEARCH_PARAMS.cursor]) }),
  ]);
  // Guests get the landing page above the feed; its pictures use the first cards of the list.
  const showLanding = !viewer;
  const topics = showLanding ? await getTopics() : [];
  const featured = page.items;

  return (
    <>
      <JsonLd data={await websiteData()} />
      {showLanding && (
        <>
          <Hero featured={featured.slice(0, 2)} topics={topics.slice(0, 4)} />
          <ProblemSection />
          <FeaturesSection resources={featured} />
          <TrustRow />
          <StepsSection resources={featured.slice(3)} />
          <StatsSection topicCount={topics.length} />
          <TopicsMarquee topics={topics} />
          <CommunitySection resources={page.items} />
        </>
      )}

      <section aria-labelledby="feed-title" className={showLanding ? "border-t border-border/70" : undefined}>
        <div className="frame px-4 py-14 sm:px-8 lg:px-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            {viewer ? (
              <h1 id="feed-title" className="text-4xl font-medium tracking-tight sm:text-5xl">
                {t("feedTitle")}
              </h1>
            ) : (
              <h2 id="feed-title" className="text-4xl font-medium sm:text-5xl">
                {t("feedTitle")}
              </h2>
            )}
            <ListTabs
              label={tFeed("tabsLabel")}
              tabs={[
                { href: routes.home, label: tFeed("popular"), active: sort === "popular" },
                { href: NEWEST_HREF, label: tFeed("newest"), active: sort === "newest" },
                ...(viewer ? [{ href: routes.following, label: tFeed("following"), active: false }] : []),
              ]}
            />
          </div>

          {page.items.length > 0 ? (
            <ResourceList
              key={sort}
              initialCards={await renderCardEntries(page.items)}
              initialCursor={page.nextCursor}
              loadMore={loadMoreResourcesAction.bind(null, query)}
              baseHref={sort === "newest" ? NEWEST_HREF : routes.home}
            />
          ) : (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyText")}
              action={{ href: routes.newResource, label: t("emptyCta") }}
            />
          )}
        </div>
      </section>
    </>
  );
}

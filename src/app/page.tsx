import { FilterIcon, LayersIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ListTabs } from "@/components/feed/list-tabs";
import { toCardEntries } from "@/components/feed/card-entries";
import { ResourceList } from "@/components/feed/resource-list";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import { type FeedQuery, SEARCH_PARAMS, SORT_PARAM_VALUES } from "@/lib/validators";
import { getViewer } from "@/server/auth/session";
import { findResources } from "@/server/services/feed";

const NEWEST_HREF = `/?${SEARCH_PARAMS.sort}=${SORT_PARAM_VALUES.newest}`;

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

  const values = [
    { icon: FilterIcon, title: t("valueSearchTitle"), text: t("valueSearchText") },
    { icon: LayersIcon, title: t("valueStructuredTitle"), text: t("valueStructuredText") },
    { icon: ShieldCheckIcon, title: t("valueQualityTitle"), text: t("valueQualityText") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4">
      {!viewer && (
        <>
          <section className="pt-10 pb-8 sm:pt-14">
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">{t("heroTitle")}</h1>
            <p className="mt-4 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">{t("heroSubtitle")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={routes.search}>{t("ctaBrowse")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={routes.newResource}>{t("ctaShare")}</Link>
              </Button>
            </div>
          </section>

          <section aria-labelledby="values-title" className="pb-10">
            <h2 id="values-title" className="sr-only">
              {t("valuesTitle", { appName: siteConfig.name })}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-3">
              {values.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-xl border bg-card p-5">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section aria-labelledby="feed-title" className={viewer ? "py-10" : "pb-16"}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {viewer ? (
            <h1 id="feed-title" className="text-2xl font-semibold tracking-tight">
              {t("feedTitle")}
            </h1>
          ) : (
            <h2 id="feed-title" className="text-xl font-semibold">
              {t("feedTitle")}
            </h2>
          )}
          <ListTabs
            label={tFeed("tabsLabel")}
            tabs={[
              { href: routes.home, label: tFeed("popular"), active: sort === "popular" },
              { href: NEWEST_HREF, label: tFeed("newest"), active: sort === "newest" },
            ]}
          />
        </div>

        {page.items.length > 0 ? (
          <ResourceList
            key={sort}
            initialCards={toCardEntries(page.items)}
            initialCursor={page.nextCursor}
            query={query}
            baseHref={sort === "newest" ? NEWEST_HREF : routes.home}
          />
        ) : (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyText")}
            action={{ href: routes.newResource, label: t("emptyCta") }}
          />
        )}
      </section>
    </div>
  );
}

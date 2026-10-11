import { SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { renderCardEntries } from "@/components/feed/card-entries";
import { ResourceList } from "@/components/feed/resource-list";
import { SearchFilters } from "@/components/search/search-filters";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { defaultSearchSort, type FeedQuery, parseSearchParams, toSearchQueryString } from "@/lib/validators";
import { loadMoreResourcesAction } from "@/server/actions/feed";
import { checkRateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { findResources } from "@/server/services/feed";
import { getTopics } from "@/server/services/topics";

export async function generateMetadata({ searchParams }: PageProps<"/qidiruv">): Promise<Metadata> {
  const t = await getTranslations("Search");
  const hasParams = Object.keys(await searchParams).length > 0;
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: routes.search },
    // Result pages for every query and filter would flood search engines; the page itself is indexed.
    robots: hasParams ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/qidiruv">) {
  const params = parseSearchParams(await searchParams);
  const [t, topics] = await Promise.all([getTranslations("Search"), getTopics()]);

  // An unknown topic in a shared link is ignored, like any other invalid filter.
  const topic = params.topic ? topics.find((item) => item.slug === params.topic) : undefined;
  const fallbackSort = defaultSearchSort(params.text);
  const sort = params.sort === "relevance" && !params.text ? fallbackSort : (params.sort ?? fallbackSort);

  const query: FeedQuery = {
    text: params.text,
    topicId: topic?.id,
    type: params.type,
    language: params.language,
    price: params.price,
    level: params.level,
    sort,
  };
  // Text searches cost the most: 60 a minute per address (D74). Browsing without text is not counted.
  const limited = Boolean(params.text) && !(await checkRateLimit("search", { ip: await clientIp() }));
  const page = limited ? { items: [], nextCursor: null } : await findResources(query, { cursor: params.cursor });

  const values = { ...params, topic: topic?.slug, sort };
  const hasFilters = Boolean(params.text || topic || params.type || params.language || params.price || params.level);
  const baseHref = `${routes.search}${toSearchQueryString({ ...values, cursor: undefined })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>

      <SearchFilters topics={topics} values={values} hasFilters={hasFilters} />

      <section aria-labelledby="results-title" className="mt-8">
        <h2 id="results-title" className="mb-4 text-lg font-semibold">
          {params.text ? t("resultsFor", { query: params.text }) : hasFilters ? t("results") : t("allResults")}
        </h2>

        {limited ? (
          <p role="status" className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
            {t("rateLimited")}
          </p>
        ) : page.items.length > 0 ? (
          <ResourceList
            key={baseHref}
            initialCards={await renderCardEntries(page.items)}
            initialCursor={page.nextCursor}
            loadMore={loadMoreResourcesAction.bind(null, query)}
            baseHref={baseHref}
          />
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
            <SearchXIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("emptyText")}</p>
            {hasFilters && (
              <Button asChild variant="outline" className="mt-5">
                <Link href={routes.search}>{t("emptyCta")}</Link>
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

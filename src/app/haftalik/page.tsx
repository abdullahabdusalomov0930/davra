import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { renderCardEntries } from "@/components/feed/card-entries";
import { EmptyState } from "@/components/layout/empty-state";
import { routes } from "@/lib/routes";
import { openGraphBase } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";
import { getWeeklyTop } from "@/server/services/weekly";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Weekly");
  return {
    title: t("title"),
    description: t("metaDescription", { appName: siteConfig.name }),
    alternates: { canonical: routes.weekly },
    openGraph: { ...openGraphBase, type: "website", url: routes.weekly },
  };
}

export default async function WeeklyPage() {
  const [t, entries] = await Promise.all([getTranslations("Weekly"), getWeeklyTop()]);
  const cards = await renderCardEntries(entries.map((entry) => entry.resource));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-pretty text-muted-foreground">{t("intro")}</p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={{ href: routes.home, label: t("emptyCta") }}
        />
      ) : (
        <ol className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
          {entries.map((entry, index) => {
            const stats = [
              entry.likes > 0 && t("likes", { count: entry.likes }),
              entry.saves > 0 && t("saves", { count: entry.saves }),
              entry.ratings > 0 && t("ratings", { count: entry.ratings }),
            ].filter(Boolean);
            return (
              <li key={entry.resource.id} className="grid content-start gap-2">
                <div className="flex items-center gap-3 text-sm">
                  {/* The list is ordered; the number is for the eye. */}
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                  >
                    {index + 1}
                  </span>
                  <p className="flex flex-wrap gap-x-1.5 text-muted-foreground">
                    <span>{t("thisWeek")}</span>
                    {stats.map((stat, position) => (
                      <span key={String(stat)}>
                        {position > 0 && <span aria-hidden>· </span>}
                        {stat}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="grid">{cards[index].card}</div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

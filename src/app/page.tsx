import { FilterIcon, LayersIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

export default async function HomePage() {
  const t = await getTranslations("Home");

  const values = [
    { icon: FilterIcon, title: t("valueSearchTitle"), text: t("valueSearchText") },
    { icon: LayersIcon, title: t("valueStructuredTitle"), text: t("valueStructuredText") },
    { icon: ShieldCheckIcon, title: t("valueQualityTitle"), text: t("valueQualityText") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-12 sm:py-16">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">{t("heroTitle")}</h1>
        <p className="mt-4 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">{t("heroSubtitle")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/qidiruv">{t("ctaBrowse")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/yangi-resurs">{t("ctaShare")}</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="values-title" className="pb-12">
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

      <section aria-labelledby="popular-title" className="pb-16">
        <h2 id="popular-title" className="mb-4 text-xl font-semibold">
          {t("popularTitle")}
        </h2>
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={{ href: "/yangi-resurs", label: t("emptyCta") }}
        />
      </section>
    </div>
  );
}

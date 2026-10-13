import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { routes } from "@/lib/routes";
import type { Topic } from "@/server/services/topics";
import type { ResourceCardData } from "@/server/services/resources";

import { HeroVisual } from "./hero-visual";
import { motion } from "./motion";
import { SearchPill } from "./search-pill";

type HeroProps = {
  /** The first cards of the feed, shown in the picture. */
  featured: readonly ResourceCardData[];
  /** A few topics to start from. */
  topics: readonly Topic[];
};

export async function Hero({ featured, topics }: HeroProps) {
  const t = await getTranslations("Home");

  return (
    <section className="relative">
      <div className="frame grid items-center gap-12 px-4 pt-12 pb-16 sm:px-8 md:grid-cols-[1.08fr_1fr] md:pt-16 md:pb-20 lg:px-12">
        <div>
          <h1 className="animate-rise text-[2.75rem] leading-[1.02] font-medium tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.5rem]">
            {t.rich("heroTitle", { hl: (chunks) => <span className="text-primary italic">{chunks}</span> })}
          </h1>
          <p className="mt-7 animate-rise text-lg font-medium text-pretty" style={motion({ delay: 120 })}>
            {t("heroLead")}
          </p>
          <p
            className="mt-2 max-w-xl animate-rise text-base text-pretty text-muted-foreground sm:text-lg"
            style={motion({ delay: 200 })}
          >
            {t("heroSubtitle")}
          </p>

          <div className="mt-8 animate-rise" style={motion({ delay: 300 })}>
            <SearchPill
              id="hero-search"
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              submitLabel={t("searchSubmit")}
            />
          </div>

          {topics.length > 0 && (
            <nav
              aria-label={t("topicsLabel")}
              className="mt-5 flex animate-rise flex-wrap items-center gap-2 pl-1 text-sm"
              style={motion({ delay: 380 })}
            >
              <span className="text-muted-foreground">{t("topicsLead")}</span>
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  href={routes.topic(topic.slug)}
                  className="rounded-full border border-foreground/15 px-3 py-1 font-medium transition-colors hover:border-primary hover:bg-accent hover:text-accent-foreground"
                >
                  {topic.name_uz}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <HeroVisual resources={featured} />
      </div>
    </section>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { routes } from "@/lib/routes";
import type { Topic } from "@/server/services/topics";
import type { ResourceCardData } from "@/server/services/resources";

import { Pencil, RightArrow } from "./doodles";
import { HeroVisual } from "./hero-visual";
import { motion } from "./motion";
import { SearchPill } from "./search-pill";

type HeroProps = {
  /** The first cards of the feed, shown as notes in the picture. */
  featured: readonly ResourceCardData[];
  /** A few topics to start from. */
  topics: readonly Topic[];
};

export async function Hero({ featured, topics }: HeroProps) {
  const t = await getTranslations("Home");

  return (
    <section className="relative">
      <div className="frame grid items-center gap-14 px-4 pt-10 pb-16 sm:px-8 md:grid-cols-[1.1fr_1fr] md:pt-16 md:pb-24 lg:px-12">
        <div className="min-w-0">
          <p className="flex -rotate-2 animate-rise items-center gap-2 font-hand text-xl text-primary sm:text-[1.4rem]">
            {t("heroNote")}
            <Pencil className="size-5" />
          </p>
          <h1
            className="mt-4 animate-rise text-[2.35rem] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-6xl lg:text-[4.1rem]"
            style={motion({ delay: 60 })}
          >
            {t.rich("heroTitle", { hl: (chunks) => <span className="marker">{chunks}</span> })}
          </h1>
          <p className="mt-7 animate-rise text-lg font-semibold text-pretty" style={motion({ delay: 120 })}>
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
              className="mt-6 flex animate-rise flex-wrap items-center gap-2.5 text-sm"
              style={motion({ delay: 380 })}
            >
              <span className="flex items-center gap-1.5 font-hand text-lg text-primary">
                {t("topicsLead")}
                <RightArrow className="h-4 w-8" />
              </span>
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  href={routes.topic(topic.slug)}
                  className="rounded-[0.625rem] border-2 border-dashed border-foreground bg-card px-3 py-1 font-medium transition duration-150 hover:-rotate-2 hover:border-solid hover:bg-marker hover:text-ink"
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

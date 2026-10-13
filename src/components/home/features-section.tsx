import { CheckIcon, LayersIcon, SearchIcon, ShieldCheckIcon, SlidersHorizontalIcon, StarIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { averageRating } from "@/components/resources/resource-meta";
import { APP_NAME } from "@/lib/config";
import type { ResourceCardData } from "@/server/services/resources";

import { motion } from "./motion";
import { Rings } from "./rings";

/**
 * "With Davra…": three promises with icons, then two product pictures: the filters, and a phone with
 * the best-rated cards. Pictures are decorative and use real labels and real cards.
 */
export async function FeaturesSection({ resources }: { resources: readonly ResourceCardData[] }) {
  const [t, tLevel, tLanguage, tPrice, format] = await Promise.all([
    getTranslations("Home"),
    getTranslations("ResourceLevel"),
    getTranslations("ResourceLanguage"),
    getTranslations("ResourcePrice"),
    getFormatter(),
  ]);

  const values = [
    { icon: SearchIcon, title: t("valueSearchTitle"), text: t("valueSearchText") },
    { icon: LayersIcon, title: t("valueStructuredTitle"), text: t("valueStructuredText") },
    { icon: ShieldCheckIcon, title: t("valueQualityTitle"), text: t("valueQualityText") },
  ];

  const filters = [
    { label: t("visual.filterLevel"), options: [tLevel("beginner"), tLevel("intermediate")] },
    { label: t("visual.filterLanguage"), options: [tLanguage("uz"), tLanguage("en")] },
    { label: t("visual.filterPrice"), options: [tPrice("free"), tPrice("paid")] },
  ];

  const top = resources.slice(0, 4);

  return (
    <section aria-labelledby="values-title" className="relative">
      <div className="frame px-4 py-20 sm:px-8 md:py-28 lg:px-12">
        <h2
          id="values-title"
          className="max-w-3xl reveal text-4xl leading-[1.05] font-medium text-balance sm:text-5xl lg:text-[3.5rem]"
        >
          {t("valuesTitle", { appName: APP_NAME })}
        </h2>

        <ul className="mt-12 grid reveal gap-10 sm:grid-cols-3 sm:gap-8">
          {values.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>

        <div aria-hidden className="mt-14 grid reveal gap-4 select-none md:grid-cols-[1.55fr_1fr]">
          {/* Filters over the warm panel */}
          <div className="relative isolate min-h-80 overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_80%_10%,#ffd2b8_0%,transparent_50%),linear-gradient(140deg,#f7dcc8_0%,#f2a679_100%)] p-6 sm:p-8 dark:bg-[radial-gradient(circle_at_80%_10%,#4a2a1a_0%,transparent_50%),linear-gradient(140deg,#2a1d16_0%,#5a2a14_100%)]">
            <Rings className="absolute -top-1/3 -right-1/4 size-[90%] max-w-none" />
            <div className="relative w-full max-w-sm rounded-2xl bg-card/95 p-5 text-card-foreground shadow-[0_24px_48px_-24px_rgb(28_20_16/0.5)] backdrop-blur">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontalIcon className="size-4 text-primary" />
                {t("visual.filtersTitle")}
              </p>
              <div className="mt-4 grid gap-3.5">
                {filters.map(({ label, options }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {options.map((option, index) => (
                        <span
                          key={option}
                          className={
                            index === 0
                              ? "inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                              : "rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                          }
                        >
                          {index === 0 && <CheckIcon className="size-3" />}
                          {option}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {top[2] && (
              <div
                className="absolute right-6 bottom-6 hidden w-64 animate-float rounded-2xl bg-night/90 p-4 text-night-foreground shadow-2xl backdrop-blur sm:block"
                style={motion({ delay: 800 })}
              >
                <p className="text-[11px] tracking-wide text-night-foreground/75 uppercase">{t("visual.matchLabel")}</p>
                <p className="mt-1 line-clamp-2 text-sm font-medium">{top[2].title}</p>
                <p className="mt-2 text-xs text-night-foreground/75">{top[2].domain}</p>
              </div>
            )}
          </div>

          {/* A phone with the best-rated cards */}
          <div className="relative flex min-h-80 items-end justify-center overflow-hidden rounded-[1.75rem] bg-secondary px-6 pt-8">
            <div className="w-full max-w-[17rem] rounded-t-[2.2rem] border-[7px] border-b-0 border-night bg-card px-4 pt-3 pb-4 text-card-foreground shadow-2xl">
              <div className="mx-auto h-5 w-20 rounded-full bg-night" />
              <p className="mt-4 font-heading text-lg font-medium">{t("visual.phoneTitle")}</p>
              <ol className="mt-3 grid gap-2.5">
                {top.map((resource, index) => {
                  const average = averageRating(resource.ratings_sum, resource.ratings_count);
                  return (
                    <li key={resource.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-muted/70 p-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {format.number(index + 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{resource.title}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                          {average === null
                            ? "—"
                            : format.number(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

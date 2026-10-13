import { CheckIcon, SlidersHorizontalIcon, StarIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { averageRating } from "@/components/resources/resource-meta";
import { APP_NAME } from "@/lib/config";
import type { ResourceCardData } from "@/server/services/resources";

import { motion } from "./motion";

/** The rank badges in the phone take the logo's colours in turn (ink on each is at least 5.5:1). */
const RANK_COLOURS = ["bg-dot-yellow", "bg-dot-orange", "bg-dot-green", "bg-postit-blue"] as const;

/**
 * "With Davra…": three numbered reasons on white cards, then two product pictures: the filters, and a
 * phone with the best-rated cards. Pictures are decorative and use real labels and real cards.
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
    { title: t("valueSearchTitle"), text: t("valueSearchText") },
    { title: t("valueStructuredTitle"), text: t("valueStructuredText") },
    { title: t("valueQualityTitle"), text: t("valueQualityText") },
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
        <div className="reveal">
          <h2
            id="values-title"
            className="max-w-3xl text-[2.1rem] leading-[1.12] font-extrabold text-balance sm:text-5xl"
          >
            {t("valuesTitle", { appName: APP_NAME })}
          </h2>
          <p className="mt-3 font-hand text-xl text-primary">({t("valuesNote")})</p>
        </div>

        <ol className="mt-10 grid reveal gap-7 sm:grid-cols-3">
          {values.map(({ title, text }, index) => (
            <li
              key={title}
              className="rounded-[1.125rem] border-[2.5px] border-foreground bg-card p-6 text-card-foreground shadow-hard transition duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg sm:p-7"
            >
              <span aria-hidden className="font-hand text-4xl leading-none text-primary">
                {format.number(index + 1)}.
              </span>
              <h3 className="mt-3 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>

        <div aria-hidden className="mt-16 grid reveal gap-6 select-none md:grid-cols-[1.55fr_1fr]">
          {/* Filters on a blue note */}
          <div className="relative min-h-80 overflow-hidden rounded-[1.25rem] border-2 border-ink bg-postit-blue p-6 text-ink sm:p-8">
            <div className="relative w-full max-w-sm rounded-2xl border-2 border-ink bg-white p-5 shadow-[5px_5px_0_var(--ink)]">
              <p className="flex items-center gap-2 text-sm font-bold">
                <SlidersHorizontalIcon className="size-4 text-pen" />
                {t("visual.filtersTitle")}
              </p>
              <div className="mt-4 grid gap-3.5">
                {filters.map(({ label, options }) => (
                  <div key={label}>
                    <p className="text-xs text-ink-soft">{label}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {options.map((option, index) => (
                        <span
                          key={option}
                          className={
                            index === 0
                              ? "inline-flex items-center gap-1 rounded-lg border-[1.5px] border-ink bg-marker px-2.5 py-1 text-xs font-semibold"
                              : "rounded-lg border-[1.5px] border-dashed border-ink/50 px-2.5 py-1 text-xs text-ink-soft"
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
                className="absolute right-6 bottom-6 hidden w-64 animate-float sm:block"
                style={motion({ delay: 800 })}
              >
                <div className="relative rotate-3 bg-postit-yellow px-4 pt-6 pb-4 shadow-[0_16px_24px_-14px_rgb(0_0_0/0.4)]">
                  <span className="tape left-[34%] -rotate-3" />
                  <p className="font-hand text-sm text-pen">{t("visual.matchLabel")}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold">{top[2].title}</p>
                  <p className="mt-2 text-xs">{top[2].domain}</p>
                </div>
              </div>
            )}
          </div>

          {/* A phone with the best-rated cards, on a pink note */}
          <div className="relative flex min-h-80 items-end justify-center overflow-hidden rounded-[1.25rem] border-2 border-ink bg-postit-pink px-6 pt-8 text-ink">
            <div className="w-full max-w-[17rem] rounded-t-[2.2rem] border-[3px] border-b-0 border-ink bg-white px-4 pt-3 pb-4">
              <div className="mx-auto h-5 w-20 rounded-full bg-ink" />
              <p className="mt-4 font-heading text-lg font-bold">{t("visual.phoneTitle")}</p>
              <ol className="mt-3 grid gap-2.5">
                {top.map((resource, index) => {
                  const average = averageRating(resource.ratings_sum, resource.ratings_count);
                  return (
                    <li
                      key={resource.id}
                      className="flex min-w-0 items-center gap-3 rounded-xl border-[1.5px] border-ink p-2.5"
                    >
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-ink text-xs font-bold ${RANK_COLOURS[index]}`}
                      >
                        {format.number(index + 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{resource.title}</span>
                        <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                          <StarIcon className="size-3 fill-dot-yellow text-dot-yellow" />
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

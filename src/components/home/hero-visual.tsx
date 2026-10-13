import { ArrowUpRightIcon, StarIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { averageRating, RESOURCE_TYPE_ICONS } from "@/components/resources/resource-meta";
import type { ResourceCardData } from "@/server/services/resources";

import { motion } from "./motion";
import { Rings } from "./rings";

/**
 * The hero's picture: a warm panel with the ring motif and real cards from the feed floating over it,
 * the way a product shot shows the app in use. Decorative (the same cards are in the feed below).
 */
export async function HeroVisual({ resources }: { resources: readonly ResourceCardData[] }) {
  const [t, tType, tLevel, tLanguage, tPrice, format] = await Promise.all([
    getTranslations("Home.visual"),
    getTranslations("ResourceType"),
    getTranslations("ResourceLevel"),
    getTranslations("ResourceLanguage"),
    getTranslations("ResourcePrice"),
    getFormatter(),
  ]);
  const [first, second] = resources;
  const rating = (resource: ResourceCardData) => {
    const average = averageRating(resource.ratings_sum, resource.ratings_count);
    return average === null ? null : format.number(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  return (
    <div
      aria-hidden
      className="relative isolate aspect-[1/1.02] w-full animate-rise overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_22%_18%,#ffd2b8_0%,transparent_55%),radial-gradient(circle_at_85%_90%,#ff7a45_0%,transparent_55%),linear-gradient(155deg,#fbe9dc_0%,#f6c4a4_55%,#f19a6c_100%)] shadow-[0_40px_80px_-40px_rgb(201_69_14/0.55)] select-none dark:bg-[radial-gradient(circle_at_22%_18%,#4a2a1a_0%,transparent_55%),radial-gradient(circle_at_85%_90%,#a8441a_0%,transparent_55%),linear-gradient(155deg,#2a1d16_0%,#3a2418_60%,#5a2a14_100%)]"
      style={motion({ delay: 150 })}
    >
      <Rings className="absolute top-1/2 left-1/2 size-[118%] max-w-none -translate-x-1/2 -translate-y-1/2" />

      {first && (
        <div
          className="absolute top-[9%] left-[7%] w-[min(19rem,74%)] animate-float rounded-2xl border border-white/60 bg-card/95 p-4 text-card-foreground shadow-[0_24px_48px_-24px_rgb(28_20_16/0.45)] backdrop-blur dark:border-white/10"
          style={motion({ delay: 0 })}
        >
          <div className="flex items-start gap-3">
            <TypeBadge type={first.type} />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm leading-snug font-semibold">{first.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {first.domain} · {tType(first.type)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
              {first.topic.name_uz}
            </span>
            {rating(first) && (
              <span className="flex items-center gap-1 font-medium">
                <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
                {rating(first)}
              </span>
            )}
          </div>
        </div>
      )}

      {first && (
        <div
          className="absolute top-[46%] right-[6%] flex animate-float items-center gap-2 rounded-full bg-card/95 py-2 pr-4 pl-2.5 text-xs font-medium text-card-foreground shadow-lg backdrop-blur"
          style={motion({ delay: 1200 })}
        >
          <span className="relative flex size-2.5">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand" />
            <span className="relative size-2.5 rounded-full bg-brand" />
          </span>
          {[tPrice(first.price), tLevel(first.level), tLanguage(first.language)].join(" · ")}
        </div>
      )}

      {second && (
        <div
          className="absolute bottom-[7%] left-[9%] w-[min(17rem,70%)] animate-float rounded-2xl bg-night/90 p-4 text-night-foreground shadow-[0_24px_48px_-20px_rgb(0_0_0/0.6)] backdrop-blur"
          style={motion({ delay: 2400 })}
        >
          <p className="font-heading text-lg leading-tight font-medium">{t("sharedTitle")}</p>
          <div className="mt-3 flex items-center gap-2 rounded-full bg-white/10 py-1.5 pr-1.5 pl-3 text-xs">
            <span className="min-w-0 flex-1 truncate">{second.title}</span>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <ArrowUpRightIcon className="size-3.5" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: ResourceCardData["type"] }) {
  const Icon = RESOURCE_TYPE_ICONS[type];
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
      <Icon className="size-4.5" />
    </span>
  );
}

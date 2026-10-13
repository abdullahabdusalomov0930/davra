import {
  BookmarkIcon,
  CheckCircle2Icon,
  HeartIcon,
  type LucideIcon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/config";
import type { ResourceCardData } from "@/server/services/resources";

/** A row of plain promises, like the badges under a product shot. */
export async function TrustRow() {
  const t = await getTranslations("Home.trust");
  const items: { icon: LucideIcon; key: "moderated" | "checked" | "free" | "uzbek" }[] = [
    { icon: ShieldCheckIcon, key: "moderated" },
    { icon: RefreshCwIcon, key: "checked" },
    { icon: SparklesIcon, key: "free" },
    { icon: MessageSquareTextIcon, key: "uzbek" },
  ];
  return (
    <section aria-label={t("label", { appName: APP_NAME })} className="border-y border-border/70">
      <ul className="frame grid grid-cols-2 gap-y-8 px-4 py-10 sm:px-8 md:grid-cols-4 lg:px-12">
        {items.map(({ icon: Icon, key }) => (
          <li key={key} className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full border-2 border-foreground/15 text-foreground/70">
              <Icon className="size-6" aria-hidden />
            </span>
            <span className="max-w-[12rem] text-sm leading-snug font-medium text-muted-foreground">{t(key)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "How does it work?": three cards, each with a small picture of that step. */
export async function StepsSection({ resources }: { resources: readonly ResourceCardData[] }) {
  const t = await getTranslations("Home.steps");
  const steps: { key: "find" | "rate" | "share"; visual: ReactNode }[] = [
    {
      key: "find",
      visual: <FindVisual query={t("findQuery")} results={resources.slice(0, 2).map((resource) => resource.title)} />,
    },
    { key: "rate", visual: <RateVisual saved={t("savedChip")} /> },
    { key: "share", visual: <ShareVisual url={t("shareUrl")} button={t("shareButton")} toast={t("shareToast")} /> },
  ];

  return (
    <section aria-labelledby="steps-title">
      <div className="frame px-4 py-20 sm:px-8 md:py-28 lg:px-12">
        <h2
          id="steps-title"
          className="max-w-2xl reveal text-4xl leading-[1.05] font-medium text-balance sm:text-5xl lg:text-[3.5rem]"
        >
          {t("title")}
        </h2>
        <ol className="-mx-4 mt-12 flex reveal snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {steps.map(({ key, visual }, index) => (
            <li key={key} className="group relative w-[82%] shrink-0 snap-start md:w-auto">
              <div
                aria-hidden
                className="relative h-72 overflow-hidden rounded-[1.75rem] bg-secondary transition-transform duration-500 select-none group-hover:-translate-y-1"
              >
                <span className="absolute right-6 bottom-3 font-heading text-8xl leading-none font-medium text-foreground/10">
                  {index + 1}
                </span>
                {visual}
              </div>
              <h3 className="mt-6 text-lg font-semibold">{t(`${key}Title`)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted-foreground">{t(`${key}Text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FindVisual({ query, results }: { query: string; results: string[] }) {
  return (
    <div className="absolute inset-x-6 top-12 grid gap-2.5">
      <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-3 text-sm shadow-lg">
        <SearchIcon className="size-4 text-muted-foreground" />
        <span>{query}</span>
        <span className="h-4 w-px animate-pulse bg-foreground" />
      </div>
      {results.map((title) => (
        <div key={title} className="flex items-center gap-3 rounded-2xl bg-card/80 px-4 py-3 text-xs shadow-sm">
          <span className="size-2 shrink-0 rounded-full bg-brand" />
          <span className="truncate font-medium">{title}</span>
        </div>
      ))}
    </div>
  );
}

function RateVisual({ saved }: { saved: string }) {
  return (
    <div className="absolute inset-x-6 top-16 flex flex-col items-center gap-5">
      <div className="flex gap-1.5 rounded-2xl bg-card px-5 py-4 shadow-lg">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            className={
              star <= 4
                ? "size-7 fill-amber-400 text-amber-400 transition-transform duration-300 group-hover:scale-110"
                : "size-7 text-muted-foreground/40"
            }
          />
        ))}
      </div>
      <div className="flex gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow">
          <BookmarkIcon className="size-3.5 fill-current" />
          {saved}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-xs font-medium shadow">
          <HeartIcon className="size-3.5 fill-brand text-brand" />
          24
        </span>
      </div>
    </div>
  );
}

function ShareVisual({ url, button, toast }: { url: string; button: string; toast: string }) {
  return (
    <div className="absolute inset-x-6 top-16 grid gap-3">
      <div className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 pl-4 text-xs shadow-lg">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{url}</span>
        <span className="rounded-full bg-primary px-3.5 py-2 font-medium text-primary-foreground">{button}</span>
      </div>
      <div className="mx-auto flex items-center gap-2 rounded-full bg-night px-4 py-2 text-xs text-night-foreground shadow-xl transition-transform duration-500 group-hover:-translate-y-1">
        <CheckCircle2Icon className="size-4 text-[#5cc495]" />
        {toast}
      </div>
    </div>
  );
}

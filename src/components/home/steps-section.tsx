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
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/config";
import type { ResourceCardData } from "@/server/services/resources";

/** A row of plain promises, each with an icon on one of the logo's coloured squares. */
export async function TrustRow() {
  const t = await getTranslations("Home.trust");
  const items: { icon: LucideIcon; key: "moderated" | "checked" | "free" | "uzbek"; square: string }[] = [
    { icon: ShieldCheckIcon, key: "moderated", square: "bg-dot-yellow text-ink -rotate-3" },
    { icon: RefreshCwIcon, key: "checked", square: "bg-dot-orange text-ink rotate-2" },
    { icon: SparklesIcon, key: "free", square: "bg-dot-green text-ink -rotate-2" },
    { icon: MessageSquareTextIcon, key: "uzbek", square: "bg-dot-purple text-white rotate-3" },
  ];
  return (
    <section aria-label={t("label", { appName: APP_NAME })}>
      <ul className="frame grid grid-cols-2 gap-y-9 px-4 py-12 sm:px-8 md:grid-cols-4 lg:px-12">
        {items.map(({ icon: Icon, key, square }) => (
          <li key={key} className="flex flex-col items-center gap-3.5 text-center">
            <span
              className={`flex size-14 items-center justify-center rounded-2xl border-2 border-ink shadow-[3px_3px_0_var(--ink)] ${square}`}
            >
              <Icon className="size-6" aria-hidden />
            </span>
            <span className="max-w-[12rem] text-sm leading-snug font-semibold">{t(key)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Each step's picture is drawn on a different note. */
const STEP_NOTES = ["bg-postit-yellow", "bg-postit-pink", "bg-postit-blue"] as const;

/** "How does it work?": three cards, each with a small picture of that step. */
export async function StepsSection({ resources }: { resources: readonly ResourceCardData[] }) {
  const [t, format] = await Promise.all([getTranslations("Home.steps"), getFormatter()]);
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
          className="max-w-2xl reveal text-[2.1rem] leading-[1.12] font-extrabold text-balance sm:text-5xl"
        >
          {t("title")}
        </h2>
        <ol className="-mx-4 mt-12 flex reveal snap-x snap-mandatory [scrollbar-width:none] gap-6 overflow-x-auto px-4 pt-1 pb-3 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {steps.map(({ key, visual }, index) => (
            <li key={key} className="group relative w-[82%] shrink-0 snap-start md:w-auto">
              <div
                aria-hidden
                className={`relative h-72 overflow-hidden rounded-[1.25rem] border-2 border-ink text-ink shadow-[5px_5px_0_var(--ink)] transition-transform duration-300 select-none group-hover:-rotate-1 ${STEP_NOTES[index]}`}
              >
                {/* A faint numeral in the corner, drawn as generated content: pure decoration, not text. */}
                <span
                  data-step={`${format.number(index + 1)}.`}
                  className="absolute right-5 bottom-2 font-hand text-7xl leading-none text-ink/15 after:content-[attr(data-step)]"
                />
                {visual}
              </div>
              <h3 className="mt-6 text-xl font-bold">{t(`${key}Title`)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted-foreground">{t(`${key}Text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* The pictures sit on light notes in both themes, so they use the fixed ink and paper colours. */

function FindVisual({ query, results }: { query: string; results: string[] }) {
  return (
    <div className="absolute inset-x-6 top-12 grid gap-2.5">
      <div className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-4 py-3 text-sm shadow-[3px_3px_0_var(--ink)]">
        <SearchIcon className="size-4 text-ink-soft" />
        <span>{query}</span>
        <span className="h-4 w-0.5 animate-pulse bg-ink" />
      </div>
      {results.map((title, index) => (
        <div
          key={title}
          className="flex items-center gap-3 rounded-xl border-[1.5px] border-ink/70 bg-white/80 px-4 py-3 text-xs"
        >
          <span className={`size-2.5 shrink-0 rounded-full ${index === 0 ? "bg-dot-orange" : "bg-dot-purple"}`} />
          <span className="truncate font-semibold">{title}</span>
        </div>
      ))}
    </div>
  );
}

function RateVisual({ saved }: { saved: string }) {
  return (
    <div className="absolute inset-x-6 top-16 flex flex-col items-center gap-5">
      <div className="flex gap-1.5 rounded-xl border-2 border-ink bg-white px-5 py-4 shadow-[3px_3px_0_var(--ink)]">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            className={
              star <= 4
                ? "size-7 fill-dot-yellow text-ink transition-transform duration-300 group-hover:scale-110"
                : "size-7 text-ink/30"
            }
          />
        ))}
      </div>
      <div className="flex gap-2">
        <span className="flex items-center gap-1.5 rounded-lg border-2 border-ink bg-marker px-3.5 py-2 text-xs font-bold">
          <BookmarkIcon className="size-3.5 fill-current" />
          {saved}
        </span>
        <span className="flex items-center gap-1.5 rounded-lg border-2 border-ink bg-white px-3.5 py-2 text-xs font-bold">
          <HeartIcon className="size-3.5 fill-dot-orange text-dot-orange" />
          24
        </span>
      </div>
    </div>
  );
}

function ShareVisual({ url, button, toast }: { url: string; button: string; toast: string }) {
  return (
    <div className="absolute inset-x-6 top-16 grid gap-4">
      <div className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white p-1.5 pl-4 text-xs shadow-[3px_3px_0_var(--ink)]">
        <span className="min-w-0 flex-1 truncate text-ink-soft">{url}</span>
        <span className="rounded-lg border-2 border-ink bg-marker px-3.5 py-2 font-bold">{button}</span>
      </div>
      <div className="mx-auto flex -rotate-2 items-center gap-2 rounded-lg bg-ink px-4 py-2 text-xs font-medium text-white transition-transform duration-500 group-hover:rotate-0">
        <CheckCircle2Icon className="size-4 text-dot-green" />
        {toast}
      </div>
    </div>
  );
}

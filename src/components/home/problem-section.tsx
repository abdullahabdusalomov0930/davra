import { AlertTriangleIcon, LinkIcon, PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/config";

import { SearchPill } from "./search-pill";

/**
 * The night page: why finding good material is hard (three cards with a small picture each and the
 * explanation behind a "+"), then Davra's answer with a second search field.
 */
export async function ProblemSection() {
  const t = await getTranslations("Home.problem");
  const tHome = await getTranslations("Home");
  const hl = (chunks: ReactNode) => <span className="marker">{chunks}</span>;

  const cards = [
    { key: "scattered", visual: <ScatteredVisual links={[t("link1"), t("link2"), t("link3")]} /> },
    { key: "outdated", visual: <OutdatedVisual url={t("deadUrl")} title={t("deadTitle")} note={t("deadNote")} /> },
    {
      key: "noise",
      visual: <NoiseVisual labels={[t("noiseAds"), t("noiseSpam"), t("noiseFree"), t("noiseYou")]} />,
    },
  ] as const;

  return (
    <section aria-labelledby="problem-title" className="dark relative border-y-2 border-ink paper text-foreground">
      <div className="frame px-4 py-20 sm:px-8 md:py-28 lg:px-12">
        <div className="max-w-3xl reveal">
          <h2 id="problem-title" className="text-[2.1rem] leading-[1.12] font-extrabold text-balance sm:text-5xl">
            {t.rich("title", { hl })}
          </h2>
          <p className="mt-6 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">{t("text")}</p>
        </div>

        <ul className="-mx-4 mt-14 flex reveal snap-x snap-mandatory [scrollbar-width:none] gap-5 overflow-x-auto px-4 pt-1 pb-3 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {cards.map(({ key, visual }) => (
            <li
              key={key}
              className="relative w-[82%] shrink-0 snap-start rounded-[1.25rem] border-2 border-foreground bg-card p-3 shadow-[5px_5px_0_var(--marker)] md:w-auto"
            >
              <div className="relative h-60 overflow-hidden rounded-[0.9rem] border border-border paper">{visual}</div>
              <details className="group/details px-2 pt-4 pb-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl [&::-webkit-details-marker]:hidden">
                  <h3 className="font-heading text-xl leading-tight font-bold">{t(`${key}Title`)}</h3>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-foreground transition duration-300 group-open/details:rotate-45 group-open/details:bg-marker group-open/details:text-ink group-hover/details:bg-muted">
                    <PlusIcon className="size-5" aria-hidden />
                    <span className="sr-only">{t("more")}</span>
                  </span>
                </summary>
                <p className="pt-3 text-sm leading-relaxed text-pretty text-muted-foreground">{t(`${key}Text`)}</p>
              </details>
            </li>
          ))}
        </ul>

        <div className="mt-24 grid reveal gap-10 md:grid-cols-2 md:items-end">
          <div>
            <h2 className="text-[2rem] leading-[1.12] font-extrabold text-balance sm:text-[2.6rem]">
              {t("answerTitle")}
            </h2>
            <p className="mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
              {t("answerText", { appName: APP_NAME })}
            </p>
          </div>
          <div>
            <p className="mb-4 font-hand text-xl text-primary">{t("tryLead")}</p>
            <SearchPill
              id="problem-search"
              label={t("tryLabel")}
              placeholder={tHome("searchPlaceholder")}
              submitLabel={tHome("searchSubmit")}
              className="shadow-[6px_6px_0_var(--marker)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Links lost in chats: notes stuck at angles, one flagged. Paper notes keep ink on pastel. */
function ScatteredVisual({ links }: { links: string[] }) {
  const notes = [
    "-rotate-6 top-6 left-5 bg-postit-yellow",
    "rotate-3 top-20 left-12 bg-postit-pink",
    "-rotate-2 top-36 left-7 bg-postit-blue",
  ];
  return (
    <div aria-hidden className="absolute inset-0">
      {links.map((link, index) => (
        <div key={link} className={`absolute w-[78%] px-3.5 py-3 text-ink shadow-lg ${notes[index]}`}>
          <div className="flex items-center gap-2 text-xs font-medium">
            <LinkIcon className="size-3.5 shrink-0" />
            <span className="truncate">{link}</span>
          </div>
          <div className="mt-2 h-1.5 w-2/3 rounded-full bg-ink/15" />
        </div>
      ))}
      <span className="absolute top-[4.6rem] right-5 flex size-11 rotate-6 items-center justify-center rounded-xl border-2 border-ink bg-marker text-ink shadow-[3px_3px_0_var(--ink)]">
        <AlertTriangleIcon className="size-5" />
      </span>
    </div>
  );
}

/** A course that no longer opens. */
function OutdatedVisual({ url, title, note }: { url: string; title: string; note: string }) {
  return (
    <div aria-hidden className="absolute inset-x-5 top-5 rounded-2xl border-2 border-foreground bg-card p-4">
      <div className="flex items-center gap-1.5">
        {["bg-dot-orange", "bg-dot-yellow", "bg-dot-green"].map((dot) => (
          <span key={dot} className={`size-2.5 rounded-full ${dot}`} />
        ))}
        <span className="ml-2 flex-1 truncate rounded-lg border border-border px-3 py-1 text-[11px] text-muted-foreground">
          {url}
        </span>
      </div>
      <p className="mt-5 font-heading text-5xl font-extrabold text-destructive">404</p>
      <p className="mt-1 text-sm">{title}</p>
      <p className="mt-4 flex items-start gap-2 rounded-lg border-2 border-dashed border-destructive px-3 py-2 text-[11px] text-destructive">
        <AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
        {note}
      </p>
    </div>
  );
}

/** Ads, spam and "free course" offers pulling at the reader. */
function NoiseVisual({ labels }: { labels: string[] }) {
  const [ads, spam, free, you] = labels;
  const box = "absolute rounded-lg border-2 border-dashed border-foreground/60 bg-card px-3 py-2 text-xs font-medium";
  return (
    <div aria-hidden className="absolute inset-0">
      <svg viewBox="0 0 300 240" className="absolute inset-0 size-full text-primary" preserveAspectRatio="none">
        <path
          d="M70 50 C120 60 130 110 150 120 M235 55 C190 70 170 105 150 120 M60 190 C110 175 130 140 150 120 M150 120 L235 190"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
      </svg>
      <span className={`${box} top-6 left-5 -rotate-3`}>{ads}</span>
      <span className={`${box} top-8 right-5 rotate-2`}>{spam}</span>
      <span className={`${box} bottom-8 left-4 rotate-1`}>{free}</span>
      <span className="absolute right-6 bottom-9 rounded-lg border-2 border-ink bg-marker px-3 py-2 text-xs font-bold text-ink shadow-[3px_3px_0_var(--ink)]">
        {you}
      </span>
    </div>
  );
}

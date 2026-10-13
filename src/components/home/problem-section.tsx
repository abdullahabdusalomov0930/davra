import { AlertTriangleIcon, LinkIcon, PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/config";

import { Rings } from "./rings";
import { SearchPill } from "./search-pill";

/**
 * The dark band: why finding good material is hard (three cards with a small picture each and the
 * explanation behind a "+"), then Davra's answer with a second search field.
 */
export async function ProblemSection() {
  const t = await getTranslations("Home.problem");
  const tHome = await getTranslations("Home");
  const hl = (chunks: ReactNode) => <span className="text-primary">{chunks}</span>;

  const cards = [
    { key: "scattered", visual: <ScatteredVisual links={[t("link1"), t("link2"), t("link3")]} /> },
    { key: "outdated", visual: <OutdatedVisual url={t("deadUrl")} title={t("deadTitle")} note={t("deadNote")} /> },
    {
      key: "noise",
      visual: <NoiseVisual labels={[t("noiseAds"), t("noiseSpam"), t("noiseFree"), t("noiseYou")]} />,
    },
  ] as const;

  return (
    <section aria-labelledby="problem-title" className="dark relative bg-night text-night-foreground">
      <div className="frame px-4 py-20 sm:px-8 md:py-28 lg:px-12">
        <div className="max-w-3xl reveal">
          <h2 id="problem-title" className="text-4xl leading-[1.05] font-medium text-balance sm:text-5xl lg:text-6xl">
            {t.rich("title", { hl })}
          </h2>
          <p className="mt-6 max-w-2xl text-base text-pretty text-night-foreground/75 sm:text-lg">{t("text")}</p>
        </div>

        <ul className="-mx-4 mt-14 flex reveal snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {cards.map(({ key, visual }) => (
            <li
              key={key}
              className="relative w-[82%] shrink-0 snap-start rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-3 md:w-auto"
            >
              <div className="relative h-60 overflow-hidden rounded-[1.4rem] bg-white/[0.03]">{visual}</div>
              <details className="group/details px-3 pt-4 pb-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl [&::-webkit-details-marker]:hidden">
                  <h3 className="font-heading text-2xl leading-tight font-medium">{t(`${key}Title`)}</h3>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition duration-300 group-open/details:rotate-45 group-open/details:bg-primary group-open/details:text-primary-foreground group-hover/details:bg-white/20">
                    <PlusIcon className="size-5" aria-hidden />
                    <span className="sr-only">{t("more")}</span>
                  </span>
                </summary>
                <p className="pt-3 text-sm leading-relaxed text-pretty text-night-foreground/75">{t(`${key}Text`)}</p>
              </details>
            </li>
          ))}
        </ul>

        <div className="mt-24 grid reveal gap-10 md:grid-cols-2 md:items-end">
          <div>
            <h2 className="text-4xl leading-[1.05] font-medium text-balance sm:text-5xl">{t("answerTitle")}</h2>
            <p className="mt-5 max-w-xl text-base text-pretty text-night-foreground/75 sm:text-lg">
              {t("answerText", { appName: APP_NAME })}
            </p>
          </div>
          <div>
            <p className="mb-4 text-base text-night-foreground/90 sm:text-lg">{t("tryLead")}</p>
            <SearchPill
              id="problem-search"
              label={t("tryLabel")}
              placeholder={tHome("searchPlaceholder")}
              submitLabel={tHome("searchSubmit")}
              className="border-white/10 shadow-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Links lost in chats: tilted message cards, one flagged. */
function ScatteredVisual({ links }: { links: string[] }) {
  const tilts = ["-rotate-6 top-6 left-5", "rotate-3 top-20 left-12", "-rotate-2 top-36 left-7"];
  return (
    <div aria-hidden className="absolute inset-0">
      {links.map((link, index) => (
        <div
          key={link}
          className={`absolute w-[78%] rounded-xl border border-[#7a3420]/70 bg-[#2a1610] px-3.5 py-3 shadow-xl ${tilts[index]}`}
        >
          <div className="flex items-center gap-2 text-xs text-[#ffb38f]">
            <LinkIcon className="size-3.5" />
            <span className="truncate">{link}</span>
          </div>
          <div className="mt-2 h-1.5 w-2/3 rounded-full bg-white/10" />
        </div>
      ))}
      <span className="absolute top-[4.6rem] right-6 flex size-11 items-center justify-center rounded-full border-2 border-[#ff6b5a]/70 bg-[#3a1410]">
        <AlertTriangleIcon className="size-5 text-[#ff8a75]" />
      </span>
    </div>
  );
}

/** A course that no longer opens. */
function OutdatedVisual({ url, title, note }: { url: string; title: string; note: string }) {
  return (
    <div
      aria-hidden
      className="absolute inset-x-5 top-5 rounded-2xl border border-white/10 bg-[#1e1712] p-4 shadow-2xl"
    >
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-2 rounded-full bg-white/20" />
        ))}
        <span className="ml-2 flex-1 truncate rounded-full bg-white/5 px-3 py-1 text-[11px] text-night-foreground/75">
          {url}
        </span>
      </div>
      <p className="mt-5 font-heading text-5xl font-medium text-[#ff8a75]">404</p>
      <p className="mt-1 text-sm text-night-foreground/90">{title}</p>
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-[#ff6b5a]/40 bg-[#ff6b5a]/10 px-3 py-2 text-[11px] text-[#ffb3a5]">
        <AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
        {note}
      </p>
    </div>
  );
}

/** Ads, spam and "free course" offers pulling at the reader. */
function NoiseVisual({ labels }: { labels: string[] }) {
  const [ads, spam, free, you] = labels;
  const box =
    "absolute rounded-xl border border-white/10 bg-[#1e1712] px-3 py-2 text-xs text-night-foreground/90 shadow-lg";
  return (
    <div aria-hidden className="absolute inset-0">
      <Rings
        tone="dark"
        className="absolute top-1/2 left-1/2 size-[150%] max-w-none -translate-x-1/2 -translate-y-1/2"
      />
      <svg viewBox="0 0 300 240" className="absolute inset-0 size-full" preserveAspectRatio="none">
        <path
          d="M70 50 C120 60 130 110 150 120 M235 55 C190 70 170 105 150 120 M60 190 C110 175 130 140 150 120 M150 120 L235 190"
          fill="none"
          stroke="#ff6a35"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      </svg>
      <span className={`${box} top-6 left-5`}>{ads}</span>
      <span className={`${box} top-8 right-5`}>{spam}</span>
      <span className={`${box} bottom-8 left-4`}>{free}</span>
      <span className="absolute right-6 bottom-9 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg">
        {you}
      </span>
    </div>
  );
}

import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { routes } from "@/lib/routes";
import type { ResourceCardData } from "@/server/services/resources";
import type { Topic } from "@/server/services/topics";

import { UpArrow } from "./doodles";
import { motion } from "./motion";

/** Each figure is a note of its own colour and tilt; they straighten up under the pointer. */
const STAT_NOTES = [
  { colour: "bg-postit-yellow", tilt: "-rotate-2", tape: "left-[38%] rotate-[3deg]" },
  { colour: "bg-postit-green", tilt: "rotate-[1.5deg]", tape: "left-[30%] -rotate-[4deg]" },
  { colour: "bg-postit-pink", tilt: "-rotate-1", tape: "left-[44%] rotate-[2deg]" },
] as const;

/** Three large notes: what Davracha costs, how much it covers, how often links are checked. */
export async function StatsSection({ topicCount }: { topicCount: number }) {
  const [t, format] = await Promise.all([getTranslations("Home.stats"), getFormatter()]);
  const tiles = [
    { value: t("priceValue"), label: t("priceLabel", { appName: APP_NAME }) },
    { value: format.number(topicCount), label: t("topicsLabel") },
    { value: t("checkValue"), label: t("checkLabel") },
  ];
  return (
    <section aria-labelledby="stats-title">
      <div className="frame px-4 pt-4 pb-24 sm:px-8 lg:px-12">
        <h2 id="stats-title" className="sr-only">
          {t("title", { appName: APP_NAME })}
        </h2>
        <ul className="grid reveal gap-10 md:grid-cols-3 md:gap-8">
          {tiles.map(({ value, label }, index) => {
            const note = STAT_NOTES[index];
            return (
              <li
                key={label}
                className={`relative flex min-h-60 flex-col justify-between px-7 pt-10 pb-7 text-ink shadow-[0_18px_28px_-16px_rgb(0_0_0/0.45)] transition-transform duration-300 hover:rotate-0 sm:px-8 ${note.colour} ${note.tilt}`}
              >
                <span aria-hidden className={`tape ${note.tape}`} />
                <span className="font-heading text-[clamp(2.75rem,4.6vw,4rem)] leading-[0.95] font-extrabold tracking-[-0.04em] whitespace-nowrap">
                  {value}
                </span>
                <span className="mt-8 max-w-[16rem] text-lg leading-snug font-semibold text-pretty">{label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Every topic as a chip on an endless, slowly moving row (still for people who prefer less motion). */
export async function TopicsMarquee({ topics }: { topics: readonly Topic[] }) {
  const t = await getTranslations("Home.topics");
  if (topics.length === 0) return null;

  const row = (copy: number) =>
    topics.map((topic) => (
      <li key={`${copy}-${topic.id}`}>
        <Link
          href={routes.topic(topic.slug)}
          tabIndex={copy === 0 ? undefined : -1}
          className="block rounded-xl border-2 border-dashed border-foreground bg-card px-5 py-2.5 font-heading text-lg font-bold whitespace-nowrap transition duration-150 hover:-rotate-2 hover:border-solid hover:bg-marker hover:text-ink hover:shadow-hard-sm sm:text-xl"
        >
          {topic.name_uz}
        </Link>
      </li>
    ));

  return (
    <section aria-labelledby="topics-title" className="overflow-hidden py-16">
      <div className="frame px-4 sm:px-8 lg:px-12">
        <h2
          id="topics-title"
          className="max-w-2xl reveal text-[2rem] leading-[1.12] font-extrabold text-balance sm:text-[2.75rem]"
        >
          {t("title")}
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-muted-foreground">{t("text")}</p>
      </div>
      <div className="relative mt-10 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] py-1">
        <div className="flex w-max marquee-track gap-3" style={motion({ duration: Math.max(30, topics.length * 4) })}>
          <ul className="flex gap-3 py-1">{row(0)}</ul>
          <ul className="flex gap-3 py-1" aria-hidden>
            {row(1)}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The closing invitation, with the people who shared the cards above stuck around it like photos. */
export async function CommunitySection({ resources }: { resources: readonly ResourceCardData[] }) {
  const [t, tNav] = await Promise.all([getTranslations("Home.community"), getTranslations("Nav")]);
  const authors = [...new Map(resources.map((resource) => [resource.author.username, resource.author])).values()].slice(
    0,
    8,
  );
  const spots = [
    "top-[8%] left-[6%] size-16 -rotate-6",
    "top-[2%] left-[24%] size-12 rotate-3",
    "bottom-[14%] left-[3%] size-12 rotate-6",
    "bottom-[4%] left-[22%] size-14 -rotate-3",
    "top-[6%] right-[8%] size-14 rotate-6",
    "top-[30%] right-[22%] size-11 -rotate-6",
    "bottom-[10%] right-[4%] size-16 -rotate-3",
    "bottom-[2%] right-[26%] size-12 rotate-3",
  ];

  return (
    <section aria-labelledby="community-title" className="relative overflow-hidden">
      <div className="relative frame px-4 py-24 sm:px-8 md:py-32 lg:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
          {authors.map((author, index) => (
            <span key={author.username} className={`absolute ${spots[index]}`}>
              <span
                className="block size-full animate-float rounded-2xl border-2 border-ink bg-white p-1 shadow-[3px_3px_0_var(--ink)]"
                style={motion({ delay: index * 650 })}
              >
                <UserAvatar
                  name={author.display_name}
                  seed={author.username}
                  className="size-full rounded-xl text-base"
                />
              </span>
            </span>
          ))}
        </div>
        <div className="relative mx-auto max-w-2xl reveal text-center">
          <h2 id="community-title" className="text-[2.1rem] leading-[1.12] font-extrabold text-balance sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-muted-foreground sm:text-lg">{t("text")}</p>
          <Button asChild size="lg" className="mt-9 px-8 text-[1.05rem] shadow-hard-lg">
            <Link href={routes.signUp}>{tNav("signup")}</Link>
          </Button>
          <p className="mt-4 flex items-center justify-center gap-1.5 font-hand text-lg text-primary">
            {t("note")}
            <UpArrow className="h-6 w-4" />
          </p>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { routes } from "@/lib/routes";
import type { ResourceCardData } from "@/server/services/resources";
import type { Topic } from "@/server/services/topics";

import { motion } from "./motion";

/** Three large orange tiles: what Davra costs, how much it covers, how often links are checked. */
export async function StatsSection({ topicCount }: { topicCount: number }) {
  const [t, format] = await Promise.all([getTranslations("Home.stats"), getFormatter()]);
  const tiles = [
    { value: t("priceValue"), label: t("priceLabel", { appName: APP_NAME }) },
    { value: format.number(topicCount), label: t("topicsLabel") },
    { value: t("checkValue"), label: t("checkLabel") },
  ];
  return (
    <section aria-labelledby="stats-title">
      <div className="frame px-4 pb-20 sm:px-8 lg:px-12">
        <h2 id="stats-title" className="sr-only">
          {t("title", { appName: APP_NAME })}
        </h2>
        <ul className="grid reveal gap-4 md:grid-cols-3">
          {tiles.map(({ value, label }) => (
            <li
              key={label}
              className="group relative flex min-h-64 flex-col justify-between overflow-hidden rounded-[1.75rem] bg-primary p-7 text-primary-foreground transition-transform duration-500 hover:-translate-y-1 sm:p-8"
            >
              <span
                aria-hidden
                className="absolute -top-16 -right-16 size-48 rounded-full border-[18px] border-white/10 transition-transform duration-700 group-hover:scale-110"
              />
              <span className="relative text-[clamp(3.5rem,8vw,5.5rem)] leading-[0.9] font-semibold tracking-[-0.05em]">
                {value}
              </span>
              <span className="relative mt-8 max-w-[16rem] text-lg leading-snug font-medium text-pretty">{label}</span>
            </li>
          ))}
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
          className="block rounded-full border border-foreground/15 bg-card px-6 py-3 font-heading text-xl font-medium whitespace-nowrap transition-colors duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground sm:text-2xl"
        >
          {topic.name_uz}
        </Link>
      </li>
    ));

  return (
    <section aria-labelledby="topics-title" className="overflow-hidden border-y border-border/70 bg-secondary/60 py-16">
      <div className="frame px-4 sm:px-8 lg:px-12">
        <h2 id="topics-title" className="max-w-2xl reveal text-4xl leading-[1.05] font-medium text-balance sm:text-5xl">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-muted-foreground">{t("text")}</p>
      </div>
      <div className="relative mt-10 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="flex w-max marquee-track gap-3" style={motion({ duration: Math.max(30, topics.length * 4) })}>
          <ul className="flex gap-3">{row(0)}</ul>
          <ul className="flex gap-3" aria-hidden>
            {row(1)}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The closing invitation, with the people who shared the cards above floating around it. */
export async function CommunitySection({ resources }: { resources: readonly ResourceCardData[] }) {
  const [t, tNav] = await Promise.all([getTranslations("Home.community"), getTranslations("Nav")]);
  const authors = [...new Map(resources.map((resource) => [resource.author.username, resource.author])).values()].slice(
    0,
    8,
  );
  const spots = [
    "top-[8%] left-[6%] size-16",
    "top-[2%] left-[24%] size-12",
    "bottom-[14%] left-[3%] size-12",
    "bottom-[4%] left-[22%] size-14",
    "top-[6%] right-[8%] size-14",
    "top-[30%] right-[22%] size-11",
    "bottom-[10%] right-[4%] size-16",
    "bottom-[2%] right-[26%] size-12",
  ];

  return (
    <section aria-labelledby="community-title" className="relative overflow-hidden">
      <div className="relative frame px-4 py-24 sm:px-8 md:py-32 lg:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
          {authors.map((author, index) => (
            <span
              key={author.username}
              className={`absolute animate-float rounded-full ring-4 ring-background ${spots[index]}`}
              style={motion({ delay: index * 650 })}
            >
              <UserAvatar name={author.display_name} seed={author.username} className="size-full text-base" />
            </span>
          ))}
        </div>
        <div className="relative mx-auto max-w-2xl reveal text-center">
          <h2 id="community-title" className="text-4xl leading-[1.05] font-medium text-balance sm:text-5xl lg:text-6xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-muted-foreground sm:text-lg">{t("text")}</p>
          <Button asChild variant="ink" size="lg" className="mt-8">
            <Link href={routes.signUp}>{tNav("signup")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

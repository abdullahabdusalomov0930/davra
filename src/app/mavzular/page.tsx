import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TopicCard } from "@/components/topics/topic-card";
import { routes } from "@/lib/routes";
import { getTopicsWithCounts } from "@/server/services/topics";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Topics");
  return { title: t("title"), description: t("metaDescription"), alternates: { canonical: routes.topics } };
}

export default async function TopicsPage() {
  const [t, topics] = await Promise.all([getTranslations("Topics"), getTopicsWithCounts()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => (
          <li key={topic.id}>
            <TopicCard topic={topic} />
          </li>
        ))}
      </ul>
    </div>
  );
}

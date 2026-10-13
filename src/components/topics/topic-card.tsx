import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { routes } from "@/lib/routes";
import type { TopicWithCount } from "@/server/services/topics";

export function TopicCard({ topic }: { topic: TopicWithCount }) {
  const t = useTranslations("Topics");

  return (
    <Link
      href={routes.topic(topic.slug)}
      className="group flex h-full flex-col gap-2 rounded-2xl border-2 border-foreground bg-card p-5 text-card-foreground shadow-hard-sm transition duration-200 outline-none hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">{topic.name_uz}</span>
        <ChevronRightIcon
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
      {topic.description_uz && (
        <span className="line-clamp-2 text-sm text-muted-foreground">{topic.description_uz}</span>
      )}
      <span className="mt-auto pt-1 text-xs font-medium text-primary">
        {t("resourceCount", { count: topic.resourceCount })}
      </span>
    </Link>
  );
}

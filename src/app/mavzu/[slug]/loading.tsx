import { getTranslations } from "next-intl/server";

import { ResourceGridSkeleton } from "@/components/feed/resource-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" role="status" aria-live="polite">
      <span className="sr-only">{t("label")}</span>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <Skeleton className="mt-8 mb-5 h-10 w-56 rounded-xl" />
      <ResourceGridSkeleton />
    </div>
  );
}

import { getTranslations } from "next-intl/server";

import { ResourceGridSkeleton } from "@/components/feed/resource-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" role="status" aria-live="polite">
      <span className="sr-only">{t("label")}</span>
      <Skeleton className="mb-6 h-9 w-40" />
      <Skeleton className="h-10 w-full" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
      <Skeleton className="mt-8 mb-4 h-6 w-48" />
      <ResourceGridSkeleton />
    </div>
  );
}

import { getTranslations } from "next-intl/server";

import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12" role="status" aria-live="polite">
      <span className="sr-only">{t("label")}</span>
      <Skeleton className="h-10 w-2/3 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

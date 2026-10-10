import { cn } from "cn";
import { StarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { averageRating } from "./resource-meta";

type RatingSummaryProps = {
  sum: number;
  count: number;
  /** Show "Hali baholanmagan" instead of nothing when there are no ratings. */
  showEmpty?: boolean;
  className?: string;
};

export function RatingSummary({ sum, count, showEmpty = false, className }: RatingSummaryProps) {
  const t = useTranslations("Resource");
  const format = useFormatter();
  const average = averageRating(sum, count);

  if (average === null) {
    return showEmpty ? <span className={cn("text-muted-foreground", className)}>{t("noRatings")}</span> : null;
  }

  const rating = format.number(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <StarIcon className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span className="sr-only">{t("rating", { rating, count })}</span>
      <span aria-hidden>
        <span className="font-medium text-foreground">{rating}</span> ({format.number(count)})
      </span>
    </span>
  );
}

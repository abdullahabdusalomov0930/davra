import { cn } from "cn";
import { StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/** Read-only stars, e.g. "★★★★☆", with the value for screen readers. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const t = useTranslations("Ratings");
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={t("starsOf", { count: value })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          aria-hidden
          className={cn("size-4", star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary } from "@/components/resources/rating-summary";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { getViewerRating, listReviews } from "@/server/services/interactions";

import { RatingForm } from "./rating-form";
import { Stars } from "./stars";

type RatingsSectionProps = {
  resource: { id: string; slug: string; status: string; ratings_sum: number; ratings_count: number };
  viewer: { kind: "guest" } | { kind: "author" } | { kind: "banned" } | { kind: "member"; id: string };
};

/** Average rating, the visitor's own rating form, and the written reviews. */
export async function RatingsSection({ resource, viewer }: RatingsSectionProps) {
  const [t, tBanned, format, now, reviews, current] = await Promise.all([
    getTranslations("Ratings"),
    getTranslations("Banned"),
    getFormatter(),
    getNow(),
    listReviews(resource.id),
    viewer.kind === "member" ? getViewerRating(viewer.id, resource.id) : null,
  ]);

  let action;
  if (resource.status !== "published") {
    action = <p className="text-sm text-muted-foreground">{t("notPublished")}</p>;
  } else if (viewer.kind === "guest") {
    action = (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4 text-sm">
        <p>{t("signIn")}</p>
        <Button asChild size="sm">
          <Link href={routes.signInTo(routes.resource(resource.slug))}>{t("submit")}</Link>
        </Button>
      </div>
    );
  } else if (viewer.kind === "author") {
    action = <p className="text-sm text-muted-foreground">{t("own")}</p>;
  } else if (viewer.kind === "banned") {
    action = <p className="text-sm text-muted-foreground">{tBanned("text")}</p>;
  } else {
    action = (
      <RatingForm
        resourceId={resource.id}
        current={
          current && {
            stars: current.stars,
            reviewText: current.review_text ?? "",
            countsInAverage: current.counts_in_average,
          }
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="ratings-title"
      className="grid gap-6 rounded-2xl border-2 border-foreground bg-card p-6 text-card-foreground shadow-hard sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ratings-title" className="text-xl font-semibold tracking-tight">
          {t("title")}
        </h2>
        <RatingSummary sum={resource.ratings_sum} count={resource.ratings_count} showEmpty className="text-sm" />
      </div>

      {action}

      {reviews.length > 0 ? (
        <ul className="grid gap-5 border-t pt-6">
          {reviews.map((review) => {
            const date = new Date(review.updated_at);
            return (
              <li key={review.user_id} className="flex gap-3">
                <UserAvatar
                  name={review.author.display_name}
                  seed={review.author.username}
                  className="size-9 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={routes.profile(review.author.username)} className="font-medium hover:underline">
                      {review.author.display_name}
                    </Link>
                    <Stars value={review.stars} />
                    <time dateTime={date.toISOString()} className="text-xs text-muted-foreground">
                      {format.relativeTime(date, now)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-pretty whitespace-pre-line">{review.review_text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border-t pt-6 text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </section>
  );
}

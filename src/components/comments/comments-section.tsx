import { EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { listComments } from "@/server/services/interactions";

import { CommentForm } from "./comment-form";
import { DeleteCommentButton } from "./delete-comment-button";

type CommentsSectionProps = {
  resource: { id: string; slug: string; status: string };
  /** The signed-in user's id, or null for guests. */
  viewerId: string | null;
};

/** Flat comments, oldest first, with the form at the end. */
export async function CommentsSection({ resource, viewerId }: CommentsSectionProps) {
  const [t, tRatings, format, now, comments] = await Promise.all([
    getTranslations("Comments"),
    getTranslations("Ratings"),
    getFormatter(),
    getNow(),
    listComments(resource.id),
  ]);

  return (
    <section
      aria-labelledby="comments-title"
      className="grid gap-6 rounded-2xl border bg-card p-6 text-card-foreground sm:p-8"
    >
      <h2 id="comments-title" className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
        {t("title")}
        {comments.length > 0 && (
          <span className="text-base font-normal text-muted-foreground">{format.number(comments.length)}</span>
        )}
      </h2>

      {comments.length > 0 ? (
        <ul className="grid gap-5">
          {comments.map((comment) => {
            const date = new Date(comment.created_at);
            return (
              <li key={comment.id} className="flex gap-3">
                <UserAvatar
                  name={comment.author.display_name}
                  src={comment.author.avatar_url}
                  className="size-9 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={routes.profile(comment.author.username)} className="font-medium hover:underline">
                      {comment.author.display_name}
                    </Link>
                    <time dateTime={date.toISOString()} className="text-xs text-muted-foreground">
                      {format.relativeTime(date, now)}
                    </time>
                    {comment.status === "hidden" && (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive">
                        <EyeOffIcon className="size-3.5" aria-hidden />
                        {t("hidden")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-pretty break-words whitespace-pre-line">{comment.body}</p>
                </div>
                {comment.author_id === viewerId && <DeleteCommentButton commentId={comment.id} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}

      <div className="border-t pt-6">
        {resource.status !== "published" ? (
          <p className="text-sm text-muted-foreground">{tRatings("notPublished")}</p>
        ) : viewerId ? (
          <CommentForm resourceId={resource.id} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4 text-sm">
            <p>{t("signIn")}</p>
            <Button asChild size="sm">
              <Link href={routes.signInTo(routes.resource(resource.slug))}>{t("signInCta")}</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

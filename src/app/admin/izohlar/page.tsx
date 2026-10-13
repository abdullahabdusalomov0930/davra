import { CheckIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { ModerationButton } from "@/components/admin/moderation-button";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { HoldReasons } from "@/components/admin/hold-reasons";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { moderateCommentAction } from "@/server/actions/moderation";
import { listHoldReasons, listPendingComments } from "@/server/services/admin";

/** Accounts younger than this are flagged in the queue. */
const NEW_ACCOUNT_MS = 3 * 24 * 60 * 60 * 1000;

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.comments") };
}

/** Comments the safety check held for a moderator. */
export default async function AdminCommentsPage() {
  const [t, format, now, comments] = await Promise.all([
    getTranslations("Admin"),
    getFormatter(),
    getNow(),
    listPendingComments(),
  ]);
  const reasons = await listHoldReasons(
    "comment",
    comments.map((comment) => comment.id),
  );

  if (comments.length === 0) return <AdminEmpty text={t("empty")} />;

  return (
    <ul className="grid gap-4">
      {comments.map((comment) => {
        const created = new Date(comment.created_at);
        const newAuthor = now.getTime() - new Date(comment.author.created_at).getTime() < NEW_ACCOUNT_MS;
        return (
          <li key={comment.id} className="grid gap-3 rounded-2xl border-2 border-foreground bg-card p-5 shadow-hard-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-muted-foreground">
              <p>
                {t("comments.on")}{" "}
                <Link
                  href={routes.resource(comment.resource.slug)}
                  className="font-medium text-foreground hover:underline"
                >
                  {comment.resource.title}
                </Link>
              </p>
              <p className="text-right">
                <Link href={routes.profile(comment.author.username)} className="font-medium hover:underline">
                  {comment.author.display_name}
                </Link>
                {newAuthor && (
                  <Badge variant="outline" className="ml-1.5">
                    {t("resources.newAuthor")}
                  </Badge>
                )}
                <br />
                <time dateTime={created.toISOString()}>{format.relativeTime(created, now)}</time>
              </p>
            </div>
            <p className="text-sm break-words whitespace-pre-line">{comment.body}</p>
            <HoldReasons reasons={reasons.get(comment.id)} />
            <div className="flex flex-wrap gap-2">
              <ModerationButton
                action={moderateCommentAction.bind(null, comment.id, "published")}
                variant="default"
                title={t("comments.publishTitle")}
                defaultReason={t("moderation.approveReason")}
              >
                <CheckIcon aria-hidden />
                {t("comments.approve")}
              </ModerationButton>
              <ModerationButton
                action={moderateCommentAction.bind(null, comment.id, "hidden")}
                variant="ghost"
                title={t("comments.hideTitle")}
                withRule
              >
                <EyeOffIcon aria-hidden />
                {t("comments.hide")}
              </ModerationButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

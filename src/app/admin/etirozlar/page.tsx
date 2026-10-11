import { CheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { ModerationButton } from "@/components/admin/moderation-button";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { handleAppealAction } from "@/server/actions/moderation";
import { listOpenAppeals } from "@/server/services/admin";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.appeals") };
}

/** Appeals against hidden or rejected content and bans, oldest first. */
export default async function AdminAppealsPage() {
  const [t, tStatus, format, now, appeals] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ResourceStatus"),
    getFormatter(),
    getNow(),
    listOpenAppeals(),
  ]);

  if (appeals.length === 0) return <AdminEmpty text={t("appeals.empty")} />;

  return (
    <ul className="grid gap-4">
      {appeals.map((appeal) => {
        const date = new Date(appeal.created_at);
        const type = appeal.target_type as "resource" | "comment" | "ban";
        return (
          <li key={appeal.id} className="grid gap-3 rounded-2xl border bg-card p-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex flex-wrap items-center gap-2">
                <Badge>{t(`appeals.target.${type}`)}</Badge>
                <Link href={routes.profile(appeal.user.username)} className="font-medium hover:underline">
                  {t("appeals.from", { name: appeal.user.display_name })}
                </Link>
              </p>
              <time dateTime={date.toISOString()} className="text-xs text-muted-foreground">
                {format.relativeTime(date, now)}
              </time>
            </div>
            {appeal.resource && (
              <p>
                <Link href={routes.resource(appeal.resource.slug)} className="font-medium hover:underline">
                  {appeal.resource.title}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">({tStatus(appeal.resource.status)})</span>
              </p>
            )}
            {appeal.comment && (
              <blockquote className="border-l-2 pl-3 break-words whitespace-pre-line text-muted-foreground italic">
                {appeal.comment.body}
              </blockquote>
            )}
            <p className="text-xs text-muted-foreground">
              {appeal.decision ? t("appeals.decision", { reason: appeal.decision }) : t("appeals.noDecision")}
            </p>
            <p className="rounded-xl bg-muted/50 p-3 break-words whitespace-pre-line">{appeal.message}</p>
            <div className="flex flex-wrap gap-2">
              <ModerationButton
                action={handleAppealAction.bind(null, appeal.id, true)}
                variant="default"
                title={t("appeals.acceptTitle")}
                description={t("appeals.acceptText")}
                defaultReason={t("moderation.acceptReason")}
              >
                <CheckIcon aria-hidden />
                {t("appeals.accept")}
              </ModerationButton>
              <ModerationButton
                action={handleAppealAction.bind(null, appeal.id, false)}
                title={t("appeals.rejectTitle")}
                defaultReason={t("moderation.rejectAppealReason")}
              >
                <XIcon aria-hidden />
                {t("appeals.reject")}
              </ModerationButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

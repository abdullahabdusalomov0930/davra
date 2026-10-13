import { CheckIcon, InfoIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { ModerationButton } from "@/components/admin/moderation-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { decidePendingActionAction } from "@/server/actions/moderation";
import { getStaffProfile } from "@/server/auth/session";
import { listPendingActions } from "@/server/services/admin";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.requests") };
}

/** Permanent bans and deletions moderators asked for (two-step severe actions): admins confirm. */
export default async function AdminRequestsPage() {
  const [t, format, now, staff, actions] = await Promise.all([
    getTranslations("Admin"),
    getFormatter(),
    getNow(),
    getStaffProfile(),
    listPendingActions(),
  ]);
  const isAdmin = staff?.role === "admin";

  return (
    <div className="grid gap-5">
      {!isAdmin && (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertDescription>{t("requests.adminOnly")}</AlertDescription>
        </Alert>
      )}
      {actions.length === 0 ? (
        <AdminEmpty text={t("requests.empty")} />
      ) : (
        <ul className="grid gap-4">
          {actions.map((action) => {
            const date = new Date(action.created_at);
            return (
              <li
                key={action.id}
                className="grid gap-3 rounded-2xl border-2 border-foreground bg-card p-5 text-sm shadow-hard-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive">{t(`requests.kind.${action.kind as "permanent_ban"}`)}</Badge>
                    {action.user && (
                      <Link href={routes.profile(action.user.username)} className="font-medium hover:underline">
                        {action.user.display_name} (@{action.user.username})
                      </Link>
                    )}
                    {action.resource && (
                      <Link href={routes.resource(action.resource.slug)} className="font-medium hover:underline">
                        {action.resource.title}
                      </Link>
                    )}
                  </p>
                  <time dateTime={date.toISOString()} className="text-xs text-muted-foreground">
                    {format.relativeTime(date, now)}
                  </time>
                </div>
                {action.comment && (
                  <blockquote className="border-l-2 pl-3 break-words whitespace-pre-line text-muted-foreground italic">
                    {action.comment.body}
                  </blockquote>
                )}
                <p>{action.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {t("requests.by", { name: action.requester?.display_name ?? t("unknownActor") })}
                </p>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <ModerationButton
                      action={decidePendingActionAction.bind(null, action.id, true)}
                      variant="destructive"
                      title={t("requests.approveTitle")}
                      defaultReason={t("requests.approveNote")}
                    >
                      <CheckIcon aria-hidden />
                      {t("requests.approve")}
                    </ModerationButton>
                    <ModerationButton
                      action={decidePendingActionAction.bind(null, action.id, false)}
                      title={t("requests.rejectTitle")}
                    >
                      <XIcon aria-hidden />
                      {t("requests.reject")}
                    </ModerationButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

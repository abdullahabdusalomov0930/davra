import { CheckIcon, EyeOffIcon, MailIcon, UserXIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { ActionButton } from "@/components/admin/action-button";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { ListTabs } from "@/components/feed/list-tabs";
import { Badge } from "@/components/ui/badge";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { handleRemovalRequestAction, handleReportAction } from "@/server/actions/moderation";
import { listOpenReports, listRemovalRequests, type OpenReport } from "@/server/services/admin";

const REMOVALS = "olib-tashlash";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.reports") };
}

/** What a report points at, with a link where there is a page. */
function ReportTarget({ report, t }: { report: OpenReport; t: Awaited<ReturnType<typeof getTranslations<"Admin">>> }) {
  if (report.resource) {
    return (
      <p>
        <span className="text-muted-foreground">{t("reports.targetResource")}: </span>
        <Link href={routes.resource(report.resource.slug)} className="font-medium hover:underline">
          {report.resource.title}
        </Link>
      </p>
    );
  }
  if (report.comment) {
    return (
      <div className="grid gap-1">
        <p>
          <span className="text-muted-foreground">{t("reports.targetComment")}: </span>
          {report.comment.resource && (
            <Link href={routes.resource(report.comment.resource.slug)} className="font-medium hover:underline">
              {report.comment.resource.title}
            </Link>
          )}
        </p>
        <blockquote className="border-l-2 pl-3 text-muted-foreground italic">{report.comment.body}</blockquote>
      </div>
    );
  }
  if (report.user) {
    return (
      <p>
        <span className="text-muted-foreground">{t("reports.targetUser")}: </span>
        <Link href={routes.profile(report.user.username)} className="font-medium hover:underline">
          {report.user.display_name} (@{report.user.username})
        </Link>
      </p>
    );
  }
  return <p className="text-muted-foreground">{t("reports.targetGone")}</p>;
}

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/shikoyatlar">) {
  const showRemovals = firstParam((await searchParams).tur) === REMOVALS;
  const [t, tReason, format, now] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ReportReason"),
    getFormatter(),
    getNow(),
  ]);

  const tabs = (
    <ListTabs
      label={t("nav.reports")}
      tabs={[
        { href: routes.adminReports, label: t("reports.reportsTab"), active: !showRemovals },
        { href: `${routes.adminReports}?tur=${REMOVALS}`, label: t("reports.removalsTab"), active: showRemovals },
      ]}
    />
  );

  if (showRemovals) {
    const requests = await listRemovalRequests();
    return (
      <div className="grid gap-5">
        {tabs}
        {requests.length === 0 ? (
          <AdminEmpty text={t("empty")} />
        ) : (
          <ul className="grid gap-4">
            {requests.map((request) => {
              const date = new Date(request.created_at);
              return (
                <li key={request.id} className="grid gap-3 rounded-2xl border bg-card p-5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      href={request.resource_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-medium break-all hover:underline"
                    >
                      {request.resource_url}
                    </a>
                    <time dateTime={date.toISOString()} className="text-xs text-muted-foreground">
                      {format.relativeTime(date, now)}
                    </time>
                  </div>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{request.requester_name}</span>
                    <a
                      href={`mailto:${request.requester_email}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <MailIcon className="size-3.5" aria-hidden />
                      {request.requester_email}
                    </a>
                  </p>
                  <p className="whitespace-pre-line">{request.details}</p>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      action={handleRemovalRequestAction.bind(null, request.id, "resolved")}
                      variant="default"
                    >
                      <CheckIcon aria-hidden />
                      {t("reports.removalDone")}
                    </ActionButton>
                    <ActionButton action={handleRemovalRequestAction.bind(null, request.id, "dismissed")}>
                      <XIcon aria-hidden />
                      {t("reports.removalDismiss")}
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const reports = await listOpenReports();
  return (
    <div className="grid gap-5">
      {tabs}
      {reports.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <ul className="grid gap-4">
          {reports.map((report) => {
            const date = new Date(report.created_at);
            const isUser = report.target_type === "user";
            return (
              <li key={report.id} className="grid gap-3 rounded-2xl border bg-card p-5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="destructive">{report.reason ? tReason(report.reason) : ""}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("reporter")}: {report.reporter?.display_name ?? t("unknownActor")} ·{" "}
                    <time dateTime={date.toISOString()}>{format.relativeTime(date, now)}</time>
                  </span>
                </div>
                <ReportTarget report={report} t={t} />
                {report.owner && !isUser && (
                  <p className="text-xs text-muted-foreground">
                    {t("by")}: {report.owner.display_name} (@{report.owner.username})
                  </p>
                )}
                {report.details && <p className="rounded-lg bg-muted/50 p-3 whitespace-pre-line">{report.details}</p>}
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    action={handleReportAction.bind(null, report.id, "takeDown")}
                    variant="destructive"
                    confirm={{ title: t("reports.takeDownTitle"), description: t("reports.takeDownText") }}
                  >
                    {isUser ? <UserXIcon aria-hidden /> : <EyeOffIcon aria-hidden />}
                    {isUser ? t("reports.banUser") : t("reports.takeDown")}
                  </ActionButton>
                  <ActionButton action={handleReportAction.bind(null, report.id, "resolve")}>
                    <CheckIcon aria-hidden />
                    {t("reports.resolve")}
                  </ActionButton>
                  <ActionButton action={handleReportAction.bind(null, report.id, "dismiss")} variant="ghost">
                    <XIcon aria-hidden />
                    {t("reports.dismiss")}
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

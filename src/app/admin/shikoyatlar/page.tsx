import { AlertTriangleIcon, CheckIcon, EyeOffIcon, MailIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { ModerationButton } from "@/components/admin/moderation-button";
import { AuthorInfo, LinkInfo } from "@/components/admin/queue-meta";
import { ListTabs } from "@/components/feed/list-tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import type { ModerationRule } from "@/lib/validators";
import { handleRemovalRequestAction, handleReportsAction } from "@/server/actions/moderation";
import { listRemovalRequests, listReportQueue, type ReportGroup } from "@/server/services/admin";

const REMOVALS = "olib-tashlash";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.reports") };
}

type Translate = Awaited<ReturnType<typeof getTranslations<"Admin">>>;

/** What the reports point at, with a link where there is a page. Severe content is never linked out. */
async function ReportTarget({ group, t }: { group: ReportGroup; t: Translate }) {
  const severe = group.priority === "severe";
  if (group.resource) {
    return (
      <div className="grid gap-1">
        <p>
          <span className="text-muted-foreground">{t("reports.targetResource")}: </span>
          <Link href={routes.resource(group.resource.slug)} className="font-medium hover:underline">
            {group.resource.title}
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          <LinkInfo
            url={group.resource.url}
            domain={group.resource.domain}
            finalUrl={group.resource.final_url}
            reputation={group.resource.reputation_status}
            open={!severe}
          />
        </p>
      </div>
    );
  }
  if (group.comment) {
    return (
      <div className="grid gap-1">
        <p>
          <span className="text-muted-foreground">{t("reports.targetComment")}: </span>
          {group.comment.resource && (
            <Link href={routes.resource(group.comment.resource.slug)} className="font-medium hover:underline">
              {group.comment.resource.title}
            </Link>
          )}
        </p>
        <blockquote className="border-l-2 pl-3 break-words whitespace-pre-line text-muted-foreground italic">
          {group.comment.body}
        </blockquote>
      </div>
    );
  }
  if (group.user) {
    return (
      <p>
        <span className="text-muted-foreground">{t("reports.targetUser")}: </span>
        <Link href={routes.profile(group.user.username)} className="font-medium hover:underline">
          {group.user.display_name} (@{group.user.username})
        </Link>
      </p>
    );
  }
  return <p className="text-muted-foreground">{t("reports.targetGone")}</p>;
}

const PRIORITY_VARIANT = { severe: "destructive", hidden: "warning", urgent: "warning", normal: "outline" } as const;

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
                <li
                  key={request.id}
                  className="grid gap-3 rounded-2xl border-2 border-foreground bg-card p-5 text-sm shadow-hard-sm"
                >
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
                    <ModerationButton
                      action={handleRemovalRequestAction.bind(null, request.id, "resolved")}
                      variant="default"
                      title={t("reports.removalDoneTitle")}
                    >
                      <CheckIcon aria-hidden />
                      {t("reports.removalDone")}
                    </ModerationButton>
                    <ModerationButton
                      action={handleRemovalRequestAction.bind(null, request.id, "dismissed")}
                      title={t("reports.removalDismissTitle")}
                    >
                      <XIcon aria-hidden />
                      {t("reports.removalDismiss")}
                    </ModerationButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const queue = await listReportQueue();

  return (
    <div className="grid gap-5">
      {tabs}
      {queue.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <ul className="grid gap-4">
          {queue.map((group) => {
            const reasons = Object.entries(
              group.reports.reduce<Record<string, number>>((counts, report) => {
                if (report.reason) counts[report.reason] = (counts[report.reason] ?? 0) + 1;
                return counts;
              }, {}),
            );
            const topReason = reasons.sort((a, b) => b[1] - a[1])[0]?.[0] as ModerationRule | undefined;
            const decide = (decision: string) =>
              handleReportsAction.bind(null, group.targetType, group.targetId, decision);
            return (
              <li
                key={group.key}
                className="grid gap-3 rounded-2xl border-2 border-foreground bg-card p-5 text-sm shadow-hard-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={PRIORITY_VARIANT[group.priority]}>{t(`reports.priority.${group.priority}`)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("reports.reporters", { count: group.reports.length })} ·{" "}
                    {t("reports.weight", {
                      weight: format.number(group.weight, { maximumFractionDigits: 2 }),
                      threshold: format.number(group.threshold),
                    })}
                  </span>
                  {reasons.map(([reason, count]) => (
                    <Badge key={reason} variant="outline">
                      {tReason(reason as "spam")} × {count}
                    </Badge>
                  ))}
                </div>
                {group.priority === "severe" && (
                  <Alert variant="destructive">
                    <AlertTriangleIcon aria-hidden />
                    <AlertDescription>{t("reports.severeNotice")}</AlertDescription>
                  </Alert>
                )}
                <ReportTarget group={group} t={t} />
                {group.owner && (
                  <p className="text-xs text-muted-foreground">
                    <AuthorInfo author={group.owner} />
                  </p>
                )}
                <ul className="grid gap-1.5 text-xs text-muted-foreground">
                  {group.reports.map((report) => {
                    const date = new Date(report.created_at);
                    return (
                      <li key={report.id}>
                        <span className="font-medium text-foreground">
                          {report.reporter?.display_name ?? t("unknownActor")}
                        </span>{" "}
                        · {report.reason ? tReason(report.reason) : null} ·{" "}
                        <time dateTime={date.toISOString()}>{format.relativeTime(date, now)}</time>
                        {report.details && <span className="block whitespace-pre-line">{report.details}</span>}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {group.targetType !== "user" && (group.resource || group.comment) && (
                    <ModerationButton
                      action={decide("take_down")}
                      variant="default"
                      title={t("reports.takeDownTitle")}
                      description={t("reports.takeDownText")}
                      withRule
                      defaultRule={topReason}
                    >
                      <EyeOffIcon aria-hidden />
                      {t("reports.takeDown")}
                    </ModerationButton>
                  )}
                  <ModerationButton
                    action={decide("resolve")}
                    title={t("reports.resolveTitle")}
                    withRule
                    defaultRule={topReason}
                  >
                    <CheckIcon aria-hidden />
                    {t("reports.resolve")}
                  </ModerationButton>
                  <ModerationButton
                    action={decide("dismiss")}
                    variant="ghost"
                    title={t("reports.dismissTitle")}
                    description={t("reports.dismissText")}
                    defaultReason={t("moderation.dismissReason")}
                  >
                    <XIcon aria-hidden />
                    {t("reports.dismiss")}
                  </ModerationButton>
                </div>
                {group.targetType === "user" && (
                  <p className="text-xs text-muted-foreground">{t("reports.userActions")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

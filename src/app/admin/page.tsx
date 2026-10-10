import { ClockIcon, FlagIcon, LinkIcon, MessageSquareIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { routes } from "@/lib/routes";
import { type AuditEntry, getModerationCounts, listAuditLog } from "@/server/services/admin";

type TranslateStatus = Awaited<ReturnType<typeof getTranslations<"ResourceStatus">>>;

/** "pending → published", a username, a topic name: whatever says the most about one log entry. */
function describe(entry: AuditEntry, tStatus: TranslateStatus): string {
  const details = (entry.details ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  if (entry.action === "resource.status") {
    const from = text(details.from);
    const to = text(details.to);
    const label = (status: string) =>
      ["pending", "published", "hidden", "rejected"].includes(status) ? tStatus(status as "pending") : status;
    return `${label(from)} → ${label(to)}`;
  }
  if (entry.action.startsWith("user."))
    return `@${text(details.username)}${details.to ? ` → ${text(details.to)}` : ""}`;
  if (entry.action.startsWith("topic.")) {
    const row = (details.after ?? details.before ?? {}) as Record<string, unknown>;
    return text(row.name_uz);
  }
  if (entry.action.startsWith("blocked_domain.")) return entry.target_id;
  if (details.from || details.to) return `${text(details.from)} → ${text(details.to)}`;
  return "";
}

export default async function AdminOverviewPage() {
  const [t, tStatus, format, now, counts, audit] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ResourceStatus"),
    getFormatter(),
    getNow(),
    getModerationCounts(),
    listAuditLog(),
  ]);

  const cards = [
    { href: routes.adminResources, label: t("counts.pending"), value: counts.pending, icon: ClockIcon },
    {
      href: routes.adminComments,
      label: t("counts.pendingComments"),
      value: counts.pendingComments,
      icon: MessageSquareIcon,
    },
    { href: routes.adminReports, label: t("counts.reports"), value: counts.reports, icon: FlagIcon },
    {
      href: `${routes.adminReports}?tur=olib-tashlash`,
      label: t("counts.removals"),
      value: counts.removals,
      icon: ShieldAlertIcon,
    },
    { href: routes.adminLinks, label: t("counts.brokenLinks"), value: counts.brokenLinks, icon: LinkIcon },
  ];

  return (
    <div className="grid gap-8">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(({ href, label, value, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50"
            >
              <Icon className="size-5 text-primary" aria-hidden />
              <span className="text-3xl font-semibold tabular-nums">{format.number(value)}</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="audit-title" className="grid gap-4">
        <h2 id="audit-title" className="text-lg font-semibold">
          {t("auditTitle")}
        </h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("auditEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {audit.map((entry) => {
              const key = `auditActions.${entry.action.replace(".", "_")}` as "auditActions.user_ban";
              const date = new Date(entry.created_at);
              return (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                  <span className="font-medium">{entry.actor?.display_name ?? t("unknownActor")}</span>
                  <span className="text-muted-foreground">{t.has(key) ? t(key) : entry.action}</span>
                  <span>{describe(entry, tStatus)}</span>
                  <time dateTime={date.toISOString()} className="ml-auto text-xs text-muted-foreground">
                    {format.relativeTime(date, now)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

import { getFormatter, getNow, getTranslations } from "next-intl/server";

import type { AuditEntry } from "@/server/services/admin";

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
  if (entry.action.startsWith("blocked_domain.") || entry.action.startsWith("blocked_term.")) return entry.target_id;
  if (entry.action.startsWith("setting."))
    return `${entry.target_id}: ${JSON.stringify(details.from)} → ${JSON.stringify(details.to)}`;
  if (entry.action.startsWith("resource.") && details.title)
    return `${text(details.title)}${details.to ? ` (${text(details.from)} → ${text(details.to)})` : ""}`;
  if (details.from || details.to) return `${text(details.from)} → ${text(details.to)}`;
  return "";
}

/** Moderation actions with who took them (or "Tizim" for automatic ones) and the reason given. */
export async function AuditList({ entries }: { entries: AuditEntry[] }) {
  const [t, tStatus, format, now] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ResourceStatus"),
    getFormatter(),
    getNow(),
  ]);
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t("auditEmpty")}</p>;
  return (
    <ul className="divide-y rounded-2xl border-2 border-foreground bg-card text-sm shadow-hard-sm">
      {entries.map((entry) => {
        const key = `auditActions.${entry.action.replace(".", "_")}` as "auditActions.user_ban";
        const date = new Date(entry.created_at);
        return (
          <li key={entry.id} className="grid gap-1 px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-medium">{entry.actor?.display_name ?? t("auditSystem")}</span>
              <span className="text-muted-foreground">{t.has(key) ? t(key) : entry.action}</span>
              <span className="min-w-0 break-words">{describe(entry, tStatus)}</span>
              <time dateTime={date.toISOString()} className="ml-auto text-xs text-muted-foreground">
                {format.relativeTime(date, now)}
              </time>
            </div>
            {entry.reason && (
              <p className="text-xs break-words text-muted-foreground">{t("auditReason", { reason: entry.reason })}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

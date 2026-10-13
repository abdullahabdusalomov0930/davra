import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/layout/empty-state";
import { AppealButton } from "@/components/notifications/appeal-button";
import { MarkRead } from "@/components/notifications/mark-read";
import { Badge } from "@/components/ui/badge";
import { uzDateTimeParts } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { MODERATION_RULES, type ModerationRule } from "@/lib/validators";
import { requireViewer } from "@/server/auth/session";
import { listAppealedTargets, listNotifications, type Notification } from "@/server/services/notifications";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notifications");
  return { title: t("title"), robots: { index: false } };
}

const APPEALABLE = new Set(["content_hidden", "content_rejected", "banned"]);

/** Slugs of the resources the notices point at, to link to them (RLS: the author sees their own). */
async function resourceSlugs(notifications: Notification[]) {
  const ids = notifications
    .filter((item) => item.target_type === "resource" && item.target_id)
    .map((item) => item.target_id!);
  if (ids.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("resources").select("id, slug").in("id", ids);
  if (error) throw error;
  return new Map(data.map((row) => [row.id, row.slug]));
}

/** In-app notices: hidden or restored content, bans, warnings and appeal decisions (no e-mail). */
export default async function NotificationsPage() {
  const viewer = await requireViewer(routes.notifications);
  const [t, tRule, tResource, format, now, notifications, appealed] = await Promise.all([
    getTranslations("Notifications"),
    getTranslations("Rules"),
    getTranslations("Resource"),
    getFormatter(),
    getNow(),
    listNotifications(),
    listAppealedTargets(),
  ]);
  const slugs = await resourceSlugs(notifications);
  const hasUnread = notifications.some((item) => !item.read_at);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>
      {hasUnread && <MarkRead />}

      {notifications.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="grid gap-3">
          {notifications.map((item) => {
            const date = new Date(item.created_at);
            const rule = MODERATION_RULES.includes(item.rule as ModerationRule) ? (item.rule as ModerationRule) : null;
            const appealType = item.kind === "banned" ? "ban" : (item.target_type as "resource" | "comment");
            const appealId = item.kind === "banned" ? viewer.id : item.target_id;
            const canAppeal =
              APPEALABLE.has(item.kind) &&
              appealId &&
              !appealed.has(`${appealType}:${appealId}`) &&
              item.rule !== "severe";
            const slug = item.target_type === "resource" && item.target_id ? slugs.get(item.target_id) : undefined;
            return (
              <li
                key={item.id}
                className={`grid gap-2 rounded-2xl border-2 border-foreground bg-card p-4 text-sm shadow-hard ${item.read_at ? "" : "border-primary/40"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium">
                    {!item.read_at && <span className="size-2 rounded-full bg-primary" aria-hidden />}
                    {t(`kind.${item.kind as "warning"}`, { target: item.target_type ?? "other" })}
                  </p>
                  <time dateTime={date.toISOString()} className="text-xs text-muted-foreground">
                    {format.relativeTime(date, now)}
                  </time>
                </div>
                {item.until && (
                  <p className="text-muted-foreground">
                    {t("until", { date: tResource("dateTime", uzDateTimeParts(format, item.until)) })}
                  </p>
                )}
                {rule && (
                  <p>
                    <Badge variant="outline">{t("rule", { rule: tRule(rule) })}</Badge>
                  </p>
                )}
                {item.message && (
                  <p className="break-words whitespace-pre-line">{t("reason", { reason: item.message })}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {slug && (
                    <Link href={routes.resource(slug)} className="text-primary underline-offset-4 hover:underline">
                      {t("openTarget")}
                    </Link>
                  )}
                  {rule && (
                    <Link href={`${routes.rules}#${rule}`} className="text-primary underline-offset-4 hover:underline">
                      {t("rulesLink")}
                    </Link>
                  )}
                  {canAppeal && <AppealButton targetType={appealType} targetId={appealId} />}
                  {APPEALABLE.has(item.kind) && appealId && appealed.has(`${appealType}:${appealId}`) && (
                    <span className="text-xs text-muted-foreground">{t("appealed")}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

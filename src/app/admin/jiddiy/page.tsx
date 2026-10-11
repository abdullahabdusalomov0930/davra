import { AlertTriangleIcon, ArchiveIcon, ShieldCheckIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { CopyButton } from "@/components/admin/copy-button";
import { ModerationButton } from "@/components/admin/moderation-button";
import { ListTabs } from "@/components/feed/list-tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { firstParam } from "@/lib/auth-links";
import { uzDateTimeParts } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { setSevereIncidentAction } from "@/server/actions/moderation";
import { getStaffProfile } from "@/server/auth/session";
import { listSevereIncidents } from "@/server/services/admin";

const STATUSES = ["open", "preserved", "closed"] as const;

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.severe") };
}

type Snapshot = Record<string, unknown>;
type ReportEntry = { reason?: string; details?: string | null; reporter_id?: string; reported_at?: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Severe incidents (admins only): the frozen copy of reported content kept as evidence (D69). Links
 * are never opened or fetched here; the address can only be copied.
 */
export default async function AdminSeverePage({ searchParams }: PageProps<"/admin/jiddiy">) {
  const staff = await getStaffProfile();
  if (staff?.role !== "admin") notFound();
  const requested = firstParam((await searchParams).holat);
  const status = STATUSES.find((value) => value === requested) ?? "open";
  const [t, tResource, format, incidents] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Resource"),
    getFormatter(),
    listSevereIncidents(status),
  ]);
  const when = (value: string) => tResource("dateTime", uzDateTimeParts(format, value));

  return (
    <div className="grid gap-5">
      <Alert variant="destructive">
        <AlertTriangleIcon aria-hidden />
        <AlertDescription>{t("severe.notice")}</AlertDescription>
      </Alert>
      <ListTabs
        label={t("nav.severe")}
        tabs={STATUSES.map((value) => ({
          href: value === "open" ? routes.adminSevere : `${routes.adminSevere}?holat=${value}`,
          label: t(`severe.status.${value}`),
          active: value === status,
        }))}
      />
      {incidents.length === 0 ? (
        <AdminEmpty text={t("severe.empty")} />
      ) : (
        <ul className="grid gap-4">
          {incidents.map((incident) => {
            const snapshot = (incident.snapshot ?? {}) as Snapshot;
            const reports = (Array.isArray(incident.reports) ? incident.reports : []) as ReportEntry[];
            const url = text(snapshot.url);
            return (
              <li key={incident.id} className="grid gap-3 rounded-2xl border border-destructive/40 bg-card p-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive">
                    {t(
                      `reports.target${incident.target_type === "resource" ? "Resource" : incident.target_type === "comment" ? "Comment" : "User"}`,
                    )}
                  </Badge>
                  <Badge variant="outline">{t(`severe.status.${incident.status as "open"}`)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("severe.reported", { date: when(incident.first_reported_at) })}
                  </span>
                </div>
                <section aria-label={t("severe.snapshot")} className="grid gap-2 rounded-xl bg-muted/50 p-3">
                  {text(snapshot.title) && <p className="font-medium">{text(snapshot.title)}</p>}
                  {text(snapshot.username) && <p className="font-medium">@{text(snapshot.username)}</p>}
                  {url && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium">{text(snapshot.domain)}</span>
                      <code className="break-all text-muted-foreground">{url}</code>
                      <CopyButton value={url} label={t("severe.copyUrl")} copiedLabel={t("severe.copied")} />
                    </div>
                  )}
                  {(text(snapshot.summary) || text(snapshot.body) || text(snapshot.bio)) && (
                    <p className="break-words whitespace-pre-line">
                      {text(snapshot.summary) || text(snapshot.body) || text(snapshot.bio)}
                    </p>
                  )}
                  {incident.author_id && (
                    <p className="text-xs text-muted-foreground">{t("severe.author", { id: incident.author_id })}</p>
                  )}
                </section>
                <div className="grid gap-1">
                  <p className="text-xs font-medium">{t("severe.reports")}</p>
                  <ul className="grid gap-1 text-xs text-muted-foreground">
                    {reports.map((report, index) => (
                      <li key={index}>
                        {report.reported_at && when(report.reported_at)}
                        {report.details && ` · ${report.details}`}
                      </li>
                    ))}
                  </ul>
                </div>
                {incident.notes && <p className="text-xs whitespace-pre-line">{incident.notes}</p>}
                <div className="flex flex-wrap gap-2">
                  {incident.status === "open" && (
                    <ModerationButton
                      action={setSevereIncidentAction.bind(null, incident.id, "preserved")}
                      variant="default"
                      title={t("severe.preserveTitle")}
                    >
                      <ShieldCheckIcon aria-hidden />
                      {t("severe.preserve")}
                    </ModerationButton>
                  )}
                  {incident.status !== "closed" && (
                    <ModerationButton
                      action={setSevereIncidentAction.bind(null, incident.id, "closed")}
                      title={t("severe.closeTitle")}
                    >
                      <ArchiveIcon aria-hidden />
                      {t("severe.close")}
                    </ModerationButton>
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

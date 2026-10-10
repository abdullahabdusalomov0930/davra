import {
  ClockIcon,
  FlagIcon,
  GavelIcon,
  LinkIcon,
  MessageSquareIcon,
  ScaleIcon,
  ShieldAlertIcon,
  SirenIcon,
} from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { AuditList } from "@/components/admin/audit-list";

import { routes } from "@/lib/routes";
import { getStaffProfile } from "@/server/auth/session";
import { getModerationCounts, listAuditLog } from "@/server/services/admin";

export default async function AdminOverviewPage() {
  const [t, format, counts, audit, staff] = await Promise.all([
    getTranslations("Admin"),
    getFormatter(),
    getModerationCounts(),
    listAuditLog(),
    getStaffProfile(),
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
    { href: routes.adminAppeals, label: t("counts.appeals"), value: counts.appeals, icon: ScaleIcon },
    { href: routes.adminRequests, label: t("counts.requests"), value: counts.requests, icon: GavelIcon },
    ...(staff?.role === "admin"
      ? [{ href: routes.adminSevere, label: t("counts.severe"), value: counts.severe, icon: SirenIcon }]
      : []),
  ];

  return (
    <div className="grid gap-8">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
        <AuditList entries={audit} />
        <p>
          <Link href={routes.adminAudit} className="text-sm text-primary underline-offset-4 hover:underline">
            {t("auditAll")}
          </Link>
        </p>
      </section>
    </div>
  );
}

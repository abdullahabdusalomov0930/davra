import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminNav } from "@/components/admin/admin-nav";
import { routes } from "@/lib/routes";
import { requireStaff } from "@/server/auth/session";
import { getModerationCounts } from "@/server/services/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: { template: `%s · ${t("title")}`, default: t("title") }, robots: { index: false } };
}

/** The moderation panel: staff only (others get a 404); every page and action is also guarded by RLS. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff(routes.admin);
  const [t, counts] = await Promise.all([getTranslations("Admin"), getModerationCounts()]);
  const isAdmin = staff.role === "admin";

  const items = [
    { href: routes.admin, label: t("nav.overview") },
    { href: routes.adminResources, label: t("nav.resources"), count: counts.pending },
    { href: routes.adminComments, label: t("nav.comments"), count: counts.pendingComments },
    { href: routes.adminReports, label: t("nav.reports"), count: counts.reports + counts.removals },
    { href: routes.adminLinks, label: t("nav.links"), count: counts.brokenLinks },
    { href: routes.adminAppeals, label: t("nav.appeals"), count: counts.appeals },
    { href: routes.adminRequests, label: t("nav.requests"), count: counts.requests },
    ...(isAdmin ? [{ href: routes.adminSevere, label: t("nav.severe"), count: counts.severe }] : []),
    { href: routes.adminUsers, label: t("nav.users") },
    { href: routes.adminTopics, label: t("nav.topics") },
    { href: routes.adminDomains, label: t("nav.domains") },
    { href: routes.adminAudit, label: t("nav.audit") },
    ...(isAdmin
      ? [
          { href: routes.adminSettings, label: t("nav.settings") },
          { href: routes.adminSecurity, label: t("nav.security") },
        ]
      : []),
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <AdminNav label={t("navLabel")} items={items} />
      {children}
    </div>
  );
}

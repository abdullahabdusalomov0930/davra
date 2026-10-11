import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuditList } from "@/components/admin/audit-list";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { listAuditLog } from "@/server/services/admin";

const PAGE = 50;

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.audit") };
}

/** The whole audit log, newest first, 50 entries a page. */
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/jurnal">) {
  const before = firstParam((await searchParams).oldin);
  const valid = before && !Number.isNaN(Date.parse(before)) ? before : undefined;
  const [t, entries] = await Promise.all([getTranslations("Admin"), listAuditLog(PAGE, valid)]);
  const last = entries.at(-1);

  return (
    <div className="grid gap-4">
      <AuditList entries={entries} />
      {entries.length === PAGE && last && (
        <p>
          <Link
            href={`${routes.adminAudit}?oldin=${encodeURIComponent(last.created_at)}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("auditOlder")}
          </Link>
        </p>
      )}
    </div>
  );
}

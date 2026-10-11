import { notFound } from "next/navigation";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { createClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/server/auth/session";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.security") };
}

/**
 * Admins: addresses with many failed sign-ins or new accounts in the last day (auth_events, D75).
 * Addresses are keyed hashes, so the same address shows the same code without revealing it.
 */
export default async function AdminSecurityPage() {
  const staff = await getStaffProfile();
  if (staff?.role !== "admin") notFound();
  const supabase = await createClient();
  const [t, format, now, { data, error }] = await Promise.all([
    getTranslations("Admin.security"),
    getFormatter(),
    getNow(),
    supabase.rpc("suspicious_auth_activity"),
  ]);
  if (error) throw error;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {data.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card text-sm">
          {data.map((row) => {
            const last = new Date(row.last_seen);
            return (
              <li key={row.ip_hash} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <code className="text-xs">{row.ip_hash.slice(0, 12)}</code>
                <span>{t("failed", { count: row.failed_sign_ins })}</span>
                <span>{t("signUps", { count: row.sign_ups })}</span>
                <time dateTime={last.toISOString()} className="ml-auto text-xs text-muted-foreground">
                  {format.relativeTime(last, now)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

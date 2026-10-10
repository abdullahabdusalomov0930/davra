import { InfoIcon, Trash2Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ActionButton } from "@/components/admin/action-button";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { DomainForm } from "@/components/admin/domain-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { removeDomainAction } from "@/server/actions/moderation";
import { getViewerProfile } from "@/server/auth/session";
import { listBlockedDomains } from "@/server/services/admin";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.domains") };
}

export default async function AdminDomainsPage() {
  const [t, viewer, domains] = await Promise.all([getTranslations("Admin"), getViewerProfile(), listBlockedDomains()]);
  const isAdmin = viewer?.role === "admin";

  return (
    <div className="grid gap-6">
      {isAdmin ? (
        <section className="rounded-2xl border bg-card p-5">
          <DomainForm />
        </section>
      ) : (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertDescription>{t("adminOnly")}</AlertDescription>
        </Alert>
      )}

      {domains.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card text-sm">
          {domains.map((domain) => (
            <li key={domain.domain} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{domain.domain}</p>
                {domain.reason && <p className="text-xs text-muted-foreground">{domain.reason}</p>}
              </div>
              {isAdmin && (
                <ActionButton
                  action={removeDomainAction.bind(null, domain.domain)}
                  variant="ghost"
                  success={t("domains.removed")}
                  confirm={{ title: t("domains.removeTitle"), description: t("domains.removeText") }}
                >
                  <Trash2Icon aria-hidden />
                  {t("domains.remove")}
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

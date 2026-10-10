import { CheckIcon, EyeOffIcon, InfoIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ActionButton } from "@/components/admin/action-button";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { routes } from "@/lib/routes";
import { handleReportAction, moderateResourceAction, setLinkStatusAction } from "@/server/actions/moderation";
import { listBrokenLinkResources, listOpenReports } from "@/server/services/admin";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.links") };
}

export default async function AdminLinksPage() {
  const [t, broken, reports] = await Promise.all([
    getTranslations("Admin"),
    listBrokenLinkResources(),
    listOpenReports({ brokenLinks: true }),
  ]);

  return (
    <div className="grid gap-8">
      <Alert>
        <InfoIcon aria-hidden />
        <AlertDescription>{t("links.checkerNote")}</AlertDescription>
      </Alert>

      <section aria-labelledby="broken-title" className="grid gap-4">
        <h2 id="broken-title" className="text-lg font-semibold">
          {t("links.brokenTitle")}
        </h2>
        {broken.length === 0 ? (
          <AdminEmpty text={t("empty")} />
        ) : (
          <ul className="grid gap-3">
            {broken.map((resource) => (
              <li
                key={resource.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-sm"
              >
                <div className="min-w-0">
                  <Link href={routes.resource(resource.slug)} className="font-medium hover:underline">
                    {resource.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{resource.url}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={setLinkStatusAction.bind(null, resource.id, "ok")}>
                    <CheckIcon aria-hidden />
                    {t("links.markOk")}
                  </ActionButton>
                  <ActionButton
                    action={moderateResourceAction.bind(null, resource.id, "hidden")}
                    variant="ghost"
                    confirm={{ title: t("resources.hideTitle"), description: t("resources.hideText") }}
                  >
                    <EyeOffIcon aria-hidden />
                    {t("links.hide")}
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="link-reports-title" className="grid gap-4">
        <h2 id="link-reports-title" className="text-lg font-semibold">
          {t("links.reportsTitle")}
        </h2>
        {reports.length === 0 ? (
          <AdminEmpty text={t("empty")} />
        ) : (
          <ul className="grid gap-3">
            {reports.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-sm"
              >
                {report.resource ? (
                  <Link href={routes.resource(report.resource.slug)} className="font-medium hover:underline">
                    {report.resource.title}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{t("reports.targetGone")}</span>
                )}
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={handleReportAction.bind(null, report.id, "resolve")}>
                    <CheckIcon aria-hidden />
                    {t("reports.resolve")}
                  </ActionButton>
                  <ActionButton action={handleReportAction.bind(null, report.id, "dismiss")} variant="ghost">
                    <XIcon aria-hidden />
                    {t("reports.dismiss")}
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

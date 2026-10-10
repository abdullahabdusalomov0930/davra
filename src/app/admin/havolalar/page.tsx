import { CheckIcon, EyeOffIcon, InfoIcon, Link2OffIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { ActionButton } from "@/components/admin/action-button";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { RecheckLinkButton } from "@/components/admin/recheck-link-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { decideLinkAction, moderateResourceAction } from "@/server/actions/moderation";
import { type LinkQueueResource, listLinkQueue } from "@/server/services/admin";

// "Hozir tekshirish" runs the link checker (up to about 11 seconds) inside a Server Action.
export const maxDuration = 30;

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.links") };
}

export default async function AdminLinksPage() {
  const [t, queue] = await Promise.all([getTranslations("Admin"), listLinkQueue()]);

  return (
    <div className="grid gap-8">
      <Alert>
        <InfoIcon aria-hidden />
        <AlertDescription>{t("links.intro")}</AlertDescription>
      </Alert>

      <section aria-labelledby="link-reports-title" className="grid gap-4">
        <h2 id="link-reports-title" className="text-lg font-semibold">
          {t("links.reportedTitle")}
        </h2>
        {queue.reported.length === 0 ? (
          <AdminEmpty text={t("empty")} />
        ) : (
          <ul className="grid gap-3">
            {queue.reported.map((entry) =>
              entry.resource ? (
                <LinkRow key={entry.id} resource={entry.resource} reports={entry.reports} />
              ) : (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-sm"
                >
                  <span className="text-muted-foreground">{t("reports.targetGone")}</span>
                  {/* Nothing left to fix: the reports are just closed. */}
                  <ActionButton action={decideLinkAction.bind(null, entry.id, "ok")} variant="ghost">
                    <XIcon aria-hidden />
                    {t("reports.dismiss")}
                  </ActionButton>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section aria-labelledby="broken-title" className="grid gap-4">
        <h2 id="broken-title" className="text-lg font-semibold">
          {t("links.brokenTitle")}
        </h2>
        {queue.broken.length === 0 ? (
          <AdminEmpty text={t("empty")} />
        ) : (
          <ul className="grid gap-3">
            {queue.broken.map((resource) => (
              <LinkRow key={resource.id} resource={resource} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_BADGES = { ok: "outline", broken: "warning", unknown: "outline" } as const;

/** One link: what the checker knows about it, and what staff can do. */
async function LinkRow({ resource, reports }: { resource: LinkQueueResource; reports?: number }) {
  const [t, format, now] = await Promise.all([getTranslations("Admin"), getFormatter(), getNow()]);
  const checkedAt = resource.last_link_check_at ? new Date(resource.last_link_check_at) : null;

  return (
    <li className="grid gap-3 rounded-2xl border bg-card p-4 text-sm">
      <div className="min-w-0">
        <Link href={routes.resource(resource.slug)} className="font-medium hover:underline">
          {resource.title}
        </Link>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {resource.url}
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <Badge variant={STATUS_BADGES[resource.link_status]}>
          {resource.link_status === "broken" && <Link2OffIcon aria-hidden />}
          {t(`links.status.${resource.link_status}`)}
        </Badge>
        {reports !== undefined && <span>{t("links.reports", { count: reports })}</span>}
        {checkedAt ? (
          <time dateTime={checkedAt.toISOString()}>
            {t("links.lastCheck", { when: format.relativeTime(checkedAt, now) })}
          </time>
        ) : (
          <span>{t("links.neverChecked")}</span>
        )}
        {resource.link_check_failures > 0 && (
          <span>{t("links.failures", { count: resource.link_check_failures })}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <RecheckLinkButton resourceId={resource.id} />
        {resource.link_status !== "broken" && (
          <ActionButton action={decideLinkAction.bind(null, resource.id, "broken")}>
            <Link2OffIcon aria-hidden />
            {t("links.markBroken")}
          </ActionButton>
        )}
        {(resource.link_status !== "ok" || reports !== undefined) && (
          <ActionButton action={decideLinkAction.bind(null, resource.id, "ok")}>
            <CheckIcon aria-hidden />
            {t("links.markOk")}
          </ActionButton>
        )}
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
  );
}

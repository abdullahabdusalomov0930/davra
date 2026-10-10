import { CheckIcon, EyeOffIcon, ExternalLinkIcon, RotateCcwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { ActionButton } from "@/components/admin/action-button";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { ListTabs } from "@/components/feed/list-tabs";
import { Badge } from "@/components/ui/badge";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { moderateResourceAction } from "@/server/actions/moderation";
import { listResourcesByStatus } from "@/server/services/admin";

const STATUSES = ["pending", "hidden", "rejected"] as const;
/** Accounts younger than this are flagged in the queue. */
const NEW_ACCOUNT_MS = 3 * 24 * 60 * 60 * 1000;

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.resources") };
}

export default async function AdminResourcesPage({ searchParams }: PageProps<"/admin/resurslar">) {
  const requested = firstParam((await searchParams).holat);
  const status = STATUSES.find((value) => value === requested) ?? "pending";
  const [t, tType, format, now, resources] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ResourceType"),
    getFormatter(),
    getNow(),
    listResourcesByStatus(status),
  ]);

  return (
    <div className="grid gap-5">
      <ListTabs
        label={t("nav.resources")}
        tabs={STATUSES.map((value) => ({
          href: value === "pending" ? routes.adminResources : `${routes.adminResources}?holat=${value}`,
          label: t(`resources.${value}`),
          active: value === status,
        }))}
      />

      {resources.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <ul className="grid gap-4">
          {resources.map((resource) => {
            const created = new Date(resource.created_at);
            const newAuthor = now.getTime() - new Date(resource.author.created_at).getTime() < NEW_ACCOUNT_MS;
            return (
              <li key={resource.id} className="grid gap-3 rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={routes.resource(resource.slug)} className="font-semibold hover:underline">
                      {resource.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge>{resource.topic.name_uz}</Badge>
                      <span>{tType(resource.type)}</span>
                      <span aria-hidden>·</span>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer ugc nofollow"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {resource.domain}
                        <ExternalLinkIcon className="size-3" aria-hidden />
                        <span className="sr-only">{t("openLink")}</span>
                      </a>
                    </p>
                  </div>
                  <p className="text-right text-xs text-muted-foreground">
                    <Link href={routes.profile(resource.author.username)} className="font-medium hover:underline">
                      {resource.author.display_name}
                    </Link>
                    {newAuthor && (
                      <Badge variant="outline" className="ml-1.5">
                        {t("resources.newAuthor")}
                      </Badge>
                    )}
                    <br />
                    <time dateTime={created.toISOString()}>{format.relativeTime(created, now)}</time>
                  </p>
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{resource.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {status === "pending" ? (
                    <>
                      <ActionButton
                        action={moderateResourceAction.bind(null, resource.id, "published")}
                        variant="default"
                      >
                        <CheckIcon aria-hidden />
                        {t("resources.approve")}
                      </ActionButton>
                      <ActionButton
                        action={moderateResourceAction.bind(null, resource.id, "rejected")}
                        confirm={{ title: t("resources.rejectTitle"), description: t("resources.rejectText") }}
                      >
                        <XIcon aria-hidden />
                        {t("resources.reject")}
                      </ActionButton>
                      <ActionButton
                        action={moderateResourceAction.bind(null, resource.id, "hidden")}
                        variant="ghost"
                        confirm={{ title: t("resources.hideTitle"), description: t("resources.hideText") }}
                      >
                        <EyeOffIcon aria-hidden />
                        {t("resources.hide")}
                      </ActionButton>
                    </>
                  ) : (
                    <ActionButton action={moderateResourceAction.bind(null, resource.id, "published")}>
                      <RotateCcwIcon aria-hidden />
                      {t("resources.restore")}
                    </ActionButton>
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

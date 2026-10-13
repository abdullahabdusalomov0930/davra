import Link from "next/link";
import { getFormatter, getNow, getTranslations } from "next-intl/server";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { HoldReasons } from "@/components/admin/hold-reasons";
import { AuthorInfo, LinkInfo } from "@/components/admin/queue-meta";
import { ResourceModeration } from "@/components/admin/resource-moderation";
import { ListTabs } from "@/components/feed/list-tabs";
import { Badge } from "@/components/ui/badge";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { getStaffProfile } from "@/server/auth/session";
import { listAuthorRecords, listHoldReasons, listResourcesByStatus } from "@/server/services/admin";

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
  const [t, tType, format, now, resources, staff] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ResourceType"),
    getFormatter(),
    getNow(),
    listResourcesByStatus(status),
    getStaffProfile(),
  ]);
  const [reasons, records] = await Promise.all([
    status === "pending"
      ? listHoldReasons(
          "resource",
          resources.map((resource) => resource.id),
        )
      : new Map<string, string[]>(),
    listAuthorRecords(resources.map((resource) => resource.author.id)),
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
              <li
                key={resource.id}
                className="grid gap-3 rounded-2xl border-2 border-foreground bg-card p-5 shadow-hard-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={routes.resource(resource.slug)} className="font-semibold hover:underline">
                      {resource.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge>{resource.topic.name_uz}</Badge>
                      <span>{tType(resource.type)}</span>
                      <span aria-hidden>·</span>
                      <LinkInfo
                        url={resource.url}
                        domain={resource.domain}
                        finalUrl={resource.final_url}
                        reputation={resource.reputation_status}
                        open={resource.moderation_state !== "severe"}
                      />
                    </p>
                  </div>
                  <p className="text-right text-xs text-muted-foreground">
                    <time dateTime={created.toISOString()}>{format.relativeTime(created, now)}</time>
                  </p>
                </div>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <AuthorInfo author={resource.author} record={records.get(resource.author.id)} />
                  {newAuthor && <Badge variant="outline">{t("resources.newAuthor")}</Badge>}
                  {resource.moderation_state && (
                    <Badge variant="destructive">{t(`state.${resource.moderation_state as "severe"}`)}</Badge>
                  )}
                </p>
                <p className="line-clamp-3 text-sm text-muted-foreground">{resource.summary}</p>
                <HoldReasons reasons={reasons.get(resource.id)} />
                <ResourceModeration
                  resourceId={resource.id}
                  status={resource.status}
                  domain={resource.domain}
                  isAdmin={staff?.role === "admin"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { renderCardEntries } from "@/components/feed/card-entries";
import { ListTabs } from "@/components/feed/list-tabs";
import { ResourceList } from "@/components/feed/resource-list";
import { EmptyState } from "@/components/layout/empty-state";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { type FeedQuery, SEARCH_PARAMS } from "@/lib/validators";
import { loadMoreResourcesAction } from "@/server/actions/feed";
import { requireViewer } from "@/server/auth/session";
import { findResources } from "@/server/services/feed";
import { getFollowing } from "@/server/services/follows";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Following");
  return { title: t("title"), robots: { index: false } };
}

/** "Obunalarim": the newest resources from the people and topics the user follows. */
export default async function FollowingPage({ searchParams }: PageProps<"/obunalarim">) {
  const viewer = await requireViewer(routes.following);
  const params = await searchParams;
  const query: FeedQuery = { sort: "newest", following: true };

  const [t, tFeed, following, page] = await Promise.all([
    getTranslations("Following"),
    getTranslations("Feed"),
    getFollowing(viewer.id),
    findResources(query, { cursor: firstParam(params[SEARCH_PARAMS.cursor]) }),
  ]);
  const followsAnything = following.topics.length > 0 || following.users.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <ListTabs
          label={tFeed("tabsLabel")}
          tabs={[
            { href: routes.home, label: tFeed("popular"), active: false },
            { href: routes.newest, label: tFeed("newest"), active: false },
            { href: routes.following, label: tFeed("following"), active: true },
          ]}
        />
      </div>

      {!followsAnything ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={{ href: routes.topics, label: t("emptyCta") }}
        />
      ) : (
        <>
          <p className="mb-4 text-muted-foreground">{t("subtitle")}</p>
          <div className="mb-8 grid gap-3 text-sm">
            {following.topics.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 font-medium">{t("topics")}:</span>
                {following.topics.map((topic) => (
                  <Badge key={topic.id} asChild>
                    <Link href={routes.topic(topic.slug)} className="hover:bg-accent/70">
                      {topic.name_uz}
                    </Link>
                  </Badge>
                ))}
              </div>
            )}
            {following.users.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 font-medium">{t("people")}:</span>
                {following.users.map((user) => (
                  <Link
                    key={user.id}
                    href={routes.profile(user.username)}
                    className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 hover:bg-muted"
                  >
                    <UserAvatar name={user.display_name} seed={user.username} className="size-5 text-[9px]" />
                    {user.display_name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {page.items.length > 0 ? (
            <ResourceList
              initialCards={await renderCardEntries(page.items)}
              initialCursor={page.nextCursor}
              loadMore={loadMoreResourcesAction.bind(null, query)}
              baseHref={routes.following}
            />
          ) : (
            <EmptyState title={t("noResourcesTitle")} description={t("noResourcesText")} />
          )}
        </>
      )}
    </div>
  );
}

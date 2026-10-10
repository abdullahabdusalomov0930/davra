import { BookOpenIcon, CalendarDaysIcon, GraduationCapIcon, PencilIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/layout/empty-state";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ResourceCard } from "@/components/resources/resource-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { uzDateParts } from "@/lib/dates";
import { siteConfig } from "@/lib/site-config";
import { getViewer } from "@/server/auth/session";
import { getPublicProfile } from "@/server/services/profiles";
import { listResourcesByAuthor } from "@/server/services/resources";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

async function loadProfile(username: string) {
  return USERNAME_PATTERN.test(username) ? getPublicProfile(username) : null;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const profile = await loadProfile((await params).username);
  if (!profile) return {};

  const t = await getTranslations("Profile");
  return {
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.bio ?? t("metaDescription", { name: profile.display_name, appName: siteConfig.name }),
    alternates: { canonical: routes.profile(profile.username) },
  };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) notFound();
  // One canonical URL per profile: /u/Nodira → /u/nodira.
  if (profile.username !== username) permanentRedirect(routes.profile(profile.username));

  const [t, tResource, format, viewer, resources] = await Promise.all([
    getTranslations("Profile"),
    getTranslations("Resource"),
    getFormatter(),
    getViewer(),
    // Others see the published cards; the owner also sees pending and hidden ones (RLS).
    listResourcesByAuthor(profile.id),
  ]);
  const isOwner = viewer?.id === profile.id;
  const { year, month } = uzDateParts(format, profile.created_at);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <article className="rounded-2xl border bg-card p-6 text-card-foreground sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar name={profile.display_name} src={profile.avatar_url} className="size-24 text-3xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight break-words">{profile.display_name}</h1>
              {profile.role !== "user" && (
                <Badge>
                  <ShieldCheckIcon aria-hidden />
                  {profile.role === "admin" ? t("roleAdmin") : t("roleModerator")}
                </Badge>
              )}
              {profile.is_banned && <Badge variant="destructive">{t("banned")}</Badge>}
            </div>
            <p className="mt-0.5 text-muted-foreground">@{profile.username}</p>
          </div>
          {isOwner && (
            <Button asChild variant="outline" className="self-start sm:self-center">
              <Link href={routes.settings}>
                <PencilIcon aria-hidden />
                {t("edit")}
              </Link>
            </Button>
          )}
        </div>

        {profile.bio && <p className="mt-6 text-pretty whitespace-pre-line">{profile.bio}</p>}

        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {profile.university && (
            <li className="flex items-center gap-1.5">
              <GraduationCapIcon className="size-4" aria-hidden />
              <span className="sr-only">{t("university")}: </span>
              {profile.university}
            </li>
          )}
          {profile.field_of_study && (
            <li className="flex items-center gap-1.5">
              <BookOpenIcon className="size-4" aria-hidden />
              <span className="sr-only">{t("fieldOfStudy")}: </span>
              {profile.field_of_study}
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <CalendarDaysIcon className="size-4" aria-hidden />
            {t("joined", { year, month })}
          </li>
        </ul>
      </article>

      <section aria-labelledby="resources-title" className="mt-10">
        <h2 id="resources-title" className="mb-4 flex items-baseline gap-2 text-xl font-semibold tracking-tight">
          {tResource("listTitle")}
          <span className="text-base font-normal text-muted-foreground">{format.number(resources.length)}</span>
        </h2>
        {resources.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {resources.map((resource) => (
              <li key={resource.id} className="grid">
                <ResourceCard resource={resource} hideAuthor />
              </li>
            ))}
          </ul>
        ) : isOwner ? (
          <EmptyState
            title={tResource("listEmptyOwnerTitle")}
            description={tResource("listEmptyOwnerText")}
            action={{ href: routes.newResource, label: tResource("listEmptyOwnerCta") }}
          />
        ) : (
          <EmptyState title={tResource("listEmptyTitle", { name: profile.display_name })} />
        )}
      </section>
    </div>
  );
}

import { ExternalLinkIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { CommentsSection } from "@/components/comments/comments-section";
import { renderCardEntries } from "@/components/feed/card-entries";
import { FollowButton } from "@/components/follow/follow-button";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingsSection } from "@/components/ratings/ratings-section";
import { DeleteResourceButton } from "@/components/resources/delete-resource-button";
import { ResourceActions, type ResourceViewer } from "@/components/resources/resource-actions";
import { RatingSummary } from "@/components/resources/rating-summary";
import { RESOURCE_TYPE_ICONS } from "@/components/resources/resource-meta";
import { ResourceStatusAlert } from "@/components/resources/resource-status-alert";
import { SiteFavicon } from "@/components/resources/site-favicon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { uzDateParts } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { isValidSlug } from "@/lib/slugify";
import { getViewer } from "@/server/auth/session";
import { findRelatedResources } from "@/server/services/feed";
import { isFollowing } from "@/server/services/follows";
import { getViewerInteractions } from "@/server/services/interactions";
import { getResourceBySlug } from "@/server/services/resources";

/** Edits within this long after creation are not worth a "Tahrirlangan" note. */
const EDIT_NOTE_AFTER_MS = 60 * 60 * 1000;

async function loadResource(slug: string) {
  return isValidSlug(slug) ? getResourceBySlug(slug) : null;
}

export async function generateMetadata({ params }: PageProps<"/resurs/[slug]">): Promise<Metadata> {
  const resource = await loadResource((await params).slug);
  if (!resource) return {};

  return {
    title: resource.title,
    description: resource.summary.length > 160 ? `${resource.summary.slice(0, 157).trimEnd()}…` : resource.summary,
    alternates: { canonical: routes.resource(resource.slug) },
    // Cards waiting for review (or hidden) are visible only to their author and staff.
    robots: resource.status === "published" ? undefined : { index: false },
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function ResourcePage({ params }: PageProps<"/resurs/[slug]">) {
  const resource = await loadResource((await params).slug);
  if (!resource) notFound();

  const [t, tType, tLanguage, tPrice, tLevel, format, viewer, related] = await Promise.all([
    getTranslations("Resource"),
    getTranslations("ResourceType"),
    getTranslations("ResourceLanguage"),
    getTranslations("ResourcePrice"),
    getTranslations("ResourceLevel"),
    getFormatter(),
    getViewer(),
    findRelatedResources(resource),
  ]);
  const isOwner = viewer?.id === resource.author_id;
  const TypeIcon = RESOURCE_TYPE_ICONS[resource.type];

  const [interactions, followsAuthor, relatedCards] = await Promise.all([
    viewer && !isOwner ? getViewerInteractions([resource.id]) : null,
    viewer && !isOwner ? isFollowing(viewer.id, { kind: "user", id: resource.author_id }) : null,
    renderCardEntries(related),
  ]);
  const actionsViewer: ResourceViewer = !viewer
    ? { kind: "guest" }
    : isOwner
      ? { kind: "author" }
      : {
          kind: "member",
          liked: Boolean(interactions?.liked.has(resource.id)),
          saved: Boolean(interactions?.saved.has(resource.id)),
        };
  const signInHere = routes.signInTo(routes.resource(resource.slug));

  const created = new Date(resource.created_at);
  const shared = new Date(resource.published_at ?? resource.created_at);
  const updated = new Date(resource.updated_at);
  const showUpdated = updated.getTime() - created.getTime() > EDIT_NOTE_AFTER_MS;

  const details = [
    { label: t("type"), value: tType(resource.type) },
    { label: t("language"), value: tLanguage(resource.language) },
    { label: t("price"), value: tPrice(resource.price) },
    { label: t("level"), value: tLevel(resource.level) },
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <ResourceStatusAlert status={resource.status} linkStatus={resource.link_status} />

      <article className="grid gap-8 rounded-2xl border bg-card p-6 text-card-foreground sm:p-8">
        <header className="grid gap-5">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <TypeIcon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <Badge asChild>
                <Link href={routes.topic(resource.topic.slug)} className="hover:bg-accent/70">
                  {resource.topic.name_uz}
                </Link>
              </Badge>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance break-words sm:text-3xl">
                {resource.title}
              </h1>
              <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                <SiteFavicon domain={resource.domain} />
                <span className="truncate">{resource.domain}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="lg">
              <a href={resource.url} target="_blank" rel="noopener noreferrer ugc nofollow">
                {t("openLink")}
                <ExternalLinkIcon aria-hidden />
                <span className="sr-only">{t("opensInNewTab")}</span>
              </a>
            </Button>
            {resource.status === "published" && (
              <ResourceActions
                resourceId={resource.id}
                likes={resource.likes_count}
                viewer={actionsViewer}
                signInHref={signInHere}
                variant="full"
              />
            )}
            {isOwner && (
              <div role="group" aria-label={t("actions")} className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="lg">
                  <Link href={routes.editResource(resource.slug)}>
                    <PencilIcon aria-hidden />
                    {t("edit")}
                  </Link>
                </Button>
                <DeleteResourceButton resourceId={resource.id} redirectTo={routes.profile(resource.author.username)} />
              </div>
            )}
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-5">
          {details.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-muted-foreground">{t("ratingTitle")}</dt>
            <dd className="mt-0.5">
              <RatingSummary sum={resource.ratings_sum} count={resource.ratings_count} showEmpty />
            </dd>
          </div>
        </dl>

        <Section title={t("summaryTitle")}>
          <p className="text-pretty whitespace-pre-line">{resource.summary}</p>
        </Section>
        <Section title={t("forWhomTitle")}>
          <p className="text-pretty whitespace-pre-line">{resource.for_whom}</p>
        </Section>
        {resource.author_review && (
          <Section title={t("authorReviewTitle")}>
            <blockquote className="border-l-2 border-primary/40 pl-4 text-pretty whitespace-pre-line italic">
              {resource.author_review}
            </blockquote>
          </Section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link href={routes.profile(resource.author.username)} className="group flex min-w-0 items-center gap-3">
              <UserAvatar name={resource.author.display_name} src={resource.author.avatar_url} className="size-10" />
              <span className="grid min-w-0">
                <span className="text-xs text-muted-foreground">{t("sharedBy")}</span>
                <span className="truncate font-medium group-hover:underline">{resource.author.display_name}</span>
              </span>
            </Link>
            {!isOwner && (
              <FollowButton
                target={{ kind: "user", id: resource.author_id }}
                following={followsAuthor}
                signInHref={signInHere}
                size="sm"
              />
            )}
          </div>
          <p className="grid text-right text-muted-foreground">
            <time dateTime={shared.toISOString()}>{t("date", uzDateParts(format, shared))}</time>
            {showUpdated && (
              <time dateTime={updated.toISOString()} className="text-xs">
                {t("updated", { date: t("date", uzDateParts(format, updated)) })}
              </time>
            )}
          </p>
        </footer>
      </article>

      <RatingsSection
        resource={resource}
        viewer={!viewer ? { kind: "guest" } : isOwner ? { kind: "author" } : { kind: "member", id: viewer.id }}
      />
      <CommentsSection resource={resource} viewerId={viewer?.id ?? null} />

      {relatedCards.length > 0 && (
        <section aria-labelledby="related-title" className="mt-4">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="related-title" className="text-xl font-semibold tracking-tight">
              {t("relatedTitle")}
            </h2>
            <Link
              href={routes.topic(resource.topic.slug)}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("relatedAll")}
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {relatedCards.map((entry) => (
              <li key={entry.id} className="grid">
                {entry.card}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

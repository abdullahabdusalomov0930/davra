import { GlobeIcon, Link2OffIcon } from "lucide-react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { uzDateParts } from "@/lib/dates";
import { routes } from "@/lib/routes";
import type { ResourceCardData } from "@/server/services/resources";

import { RatingSummary } from "./rating-summary";
import { ResourceActions, type ResourceViewer } from "./resource-actions";
import { RESOURCE_TYPE_ICONS } from "./resource-meta";
import { ResourceTags } from "./resource-tags";

type ResourceCardProps = {
  resource: ResourceCardData;
  /** The visitor's relation to the card, for the like and save buttons. */
  viewer: ResourceViewer;
  /** Hide the author row, e.g. on the author's own profile. */
  hideAuthor?: boolean;
};

/**
 * A resource in a list. The whole card links to the resource page; the topic and author links sit
 * above that link so they stay clickable on their own.
 */
export function ResourceCard({ resource, viewer, hideAuthor = false }: ResourceCardProps) {
  const t = useTranslations("Resource");
  const tType = useTranslations("ResourceType");
  const tStatus = useTranslations("ResourceStatus");
  const format = useFormatter();
  const now = useNow();

  const TypeIcon = RESOURCE_TYPE_ICONS[resource.type];
  const date = new Date(resource.published_at ?? resource.created_at);

  return (
    <article className="group relative flex min-w-0 flex-col gap-3 rounded-[1.5rem] border border-border/80 bg-card p-5 text-card-foreground transition-all duration-300 focus-within:border-primary/60 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_48px_-28px_rgb(28_20_16/0.35)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-transform duration-300 group-hover:-rotate-6">
          <TypeIcon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[1.05rem] leading-snug font-semibold text-balance">
            <Link
              href={routes.resource(resource.slug)}
              className="outline-none after:absolute after:inset-0 after:rounded-[1.5rem] focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {resource.title}
            </Link>
          </h3>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <GlobeIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{resource.domain}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{tType(resource.type)}</span>
            <span aria-hidden>·</span>
            <time className="shrink-0" dateTime={date.toISOString()} title={t("date", uzDateParts(format, date))}>
              {format.relativeTime(date, now)}
            </time>
          </p>
        </div>
        {resource.status !== "published" && (
          <Badge variant={resource.status === "pending" ? "default" : "destructive"} className="shrink-0">
            {tStatus(resource.status)}
          </Badge>
        )}
      </div>

      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{resource.summary}</p>

      <div className="flex flex-wrap gap-1.5">
        {resource.status === "published" && resource.link_status === "broken" && (
          <Badge variant="warning" title={t("brokenTitle")}>
            <Link2OffIcon aria-hidden />
            {t("brokenBadge")}
          </Badge>
        )}
        <Badge asChild>
          <Link href={routes.topic(resource.topic.slug)} className="relative z-10 hover:bg-accent/70">
            {resource.topic.name_uz}
          </Link>
        </Badge>
        <ResourceTags language={resource.language} price={resource.price} level={resource.level} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
        {hideAuthor ? (
          <span />
        ) : (
          <Link
            href={routes.profile(resource.author.username)}
            className="relative z-10 flex min-w-0 items-center gap-2 rounded-md hover:text-foreground"
          >
            <UserAvatar
              name={resource.author.display_name}
              seed={resource.author.username}
              className="size-6 text-[10px]"
            />
            <span className="truncate">{resource.author.display_name}</span>
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <RatingSummary sum={resource.ratings_sum} count={resource.ratings_count} />
          <ResourceActions
            resourceId={resource.id}
            likes={resource.likes_count}
            viewer={viewer}
            signInHref={routes.signInTo(routes.resource(resource.slug))}
          />
        </div>
      </div>
    </article>
  );
}

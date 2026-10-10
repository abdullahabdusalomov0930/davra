"use client";

import { cn } from "cn";
import { BookmarkIcon, HeartIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/action-result";
import { setLikeAction, setSaveAction } from "@/server/actions/interactions";

/** Who is looking: a guest, the resource's author, or another member (with their current state). */
export type ResourceViewer =
  { kind: "guest" } | { kind: "author" } | { kind: "member"; liked: boolean; saved: boolean };

type ResourceActionsProps = {
  resourceId: string;
  likes: number;
  viewer: ResourceViewer;
  /** Where guests sign in (returns to the resource afterwards). */
  signInHref: string;
  /** Compact icon buttons on cards, labelled buttons on the resource page. */
  variant?: "compact" | "full";
  className?: string;
};

/**
 * Like and save, applied at once (optimistic) and rolled back with a message if the server refuses.
 * The database keeps the counters; guests are sent to sign in, authors only see the count.
 */
export function ResourceActions({
  resourceId,
  likes,
  viewer,
  signInHref,
  variant = "compact",
  className,
}: ResourceActionsProps) {
  const t = useTranslations("Interactions");
  const tAction = useTranslations("ActionErrors");
  const member = viewer.kind === "member" ? viewer : null;

  const [state, setState] = useState({ liked: member?.liked ?? false, saved: member?.saved ?? false, likes });
  const [pending, setPending] = useState<"like" | "save" | null>(null);

  async function toggle(kind: "like" | "save") {
    if (pending) return;
    const previous = state;
    const next =
      kind === "like"
        ? { ...state, liked: !state.liked, likes: state.likes + (state.liked ? -1 : 1) }
        : { ...state, saved: !state.saved };
    setState(next);
    setPending(kind);

    const result = await callAction(() =>
      kind === "like" ? setLikeAction(resourceId, next.liked) : setSaveAction(resourceId, next.saved),
    );
    setPending(null);
    if (!result.ok) {
      setState(previous);
      toast.error(tAction(result.error));
    }
  }

  const full = variant === "full";
  const size = full ? "lg" : "sm";
  const likeContent = (
    <>
      <HeartIcon aria-hidden className={cn(state.liked && "fill-rose-500 text-rose-500")} />
      {full && <span>{t("like")}</span>}
      {/* Plain digits: browsers without Uzbek number data would group thousands differently. */}
      <span className="tabular-nums">{state.likes}</span>
    </>
  );
  const saveContent = (
    <>
      <BookmarkIcon aria-hidden className={cn(state.saved && "fill-primary text-primary")} />
      {full ? <span>{state.saved ? t("saved") : t("save")}</span> : <span className="sr-only">{t("saveLabel")}</span>}
    </>
  );
  const buttonClass = cn("relative z-10", !full && "h-8 gap-1.5 px-2 text-muted-foreground");

  if (viewer.kind === "author") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-sm text-muted-foreground", className)}
        title={t("ownResource")}
      >
        <HeartIcon className="size-4" aria-hidden />
        <span className="sr-only">{t("likes", { count: likes })}</span>
        <span aria-hidden className="tabular-nums">
          {likes}
        </span>
      </span>
    );
  }

  if (viewer.kind === "guest") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Button asChild variant={full ? "outline" : "ghost"} size={size} className={buttonClass}>
          <Link href={signInHref} aria-label={`${t("signInToLike")} (${t("likes", { count: likes })})`}>
            {likeContent}
          </Link>
        </Button>
        <Button asChild variant={full ? "outline" : "ghost"} size={size} className={buttonClass}>
          <Link href={signInHref} aria-label={t("signInToSave")}>
            {saveContent}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant={full ? "outline" : "ghost"}
        size={size}
        className={buttonClass}
        aria-pressed={state.liked}
        aria-label={`${t("likeLabel")} (${t("likes", { count: state.likes })})`}
        aria-busy={pending === "like"}
        onClick={() => void toggle("like")}
      >
        {likeContent}
      </Button>
      <Button
        type="button"
        variant={full ? "outline" : "ghost"}
        size={size}
        className={buttonClass}
        aria-pressed={state.saved}
        aria-label={full ? undefined : t("saveLabel")}
        aria-busy={pending === "save"}
        onClick={() => void toggle("save")}
      >
        {saveContent}
      </Button>
    </div>
  );
}

"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/action-result";
import { setFollowTopicAction, setFollowUserAction } from "@/server/actions/interactions";

type FollowButtonProps = {
  target: { kind: "user" | "topic"; id: string };
  /** null for guests (the button then leads to sign-in). */
  following: boolean | null;
  signInHref: string;
  size?: "sm" | "default";
};

/** Follow or unfollow a person or a topic, applied at once and rolled back if the server refuses. */
export function FollowButton({ target, following, signInHref, size = "default" }: FollowButtonProps) {
  const t = useTranslations("Interactions");
  const tAction = useTranslations("ActionErrors");
  const [active, setActive] = useState(following ?? false);
  const [pending, setPending] = useState(false);

  if (following === null) {
    return (
      <Button asChild variant="outline" size={size}>
        <Link href={signInHref} aria-label={t("signInToFollow")}>
          <PlusIcon aria-hidden />
          {t("follow")}
        </Link>
      </Button>
    );
  }

  async function toggle() {
    if (pending) return;
    const next = !active;
    setActive(next);
    setPending(true);
    const result = await callAction(() =>
      target.kind === "user" ? setFollowUserAction(target.id, next) : setFollowTopicAction(target.id, next),
    );
    setPending(false);
    if (!result.ok) {
      setActive(!next);
      toast.error(tAction(result.error));
    }
  }

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "default"}
      size={size}
      aria-pressed={active}
      aria-busy={pending}
      onClick={() => void toggle()}
    >
      {active ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden />}
      {active ? t("followingState") : t("follow")}
    </Button>
  );
}

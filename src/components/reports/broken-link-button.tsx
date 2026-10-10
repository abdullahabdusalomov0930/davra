"use client";

import { CheckIcon, Link2OffIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/action-result";
import { routes } from "@/lib/routes";
import { reportBrokenLinkAction } from "@/server/actions/reports";

type BrokenLinkButtonProps = {
  resourceId: string;
  /** Guests are sent to sign-in and back to `returnTo`. */
  signedIn: boolean;
  returnTo: string;
};

/** "Havola ishlamayapti": one click tells the moderators; the link checker looks at it as well. */
export function BrokenLinkButton({ resourceId, signedIn, returnTo }: BrokenLinkButtonProps) {
  const t = useTranslations("BrokenLink");
  const tAction = useTranslations("ActionErrors");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const className = "text-muted-foreground hover:text-foreground";

  if (!signedIn) {
    return (
      <Button asChild variant="ghost" size="sm" className={className}>
        <Link href={routes.signInTo(returnTo)} title={t("signIn")}>
          <Link2OffIcon aria-hidden />
          {t("button")}
        </Link>
      </Button>
    );
  }

  async function report() {
    setState("sending");
    const result = await callAction(() => reportBrokenLinkAction(resourceId));
    if (!result.ok) {
      setState(result.error === "alreadyReportedLink" ? "sent" : "idle");
      toast.error(tAction(result.error));
      return;
    }
    setState("sent");
    toast.success(t("sent"));
  }

  if (state === "sent") {
    return (
      <Button variant="ghost" size="sm" className={className} disabled>
        <CheckIcon aria-hidden />
        {t("reported")}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      title={t("title")}
      disabled={state === "sending"}
      aria-busy={state === "sending"}
      onClick={() => void report()}
    >
      {state === "sending" ? <Loader2Icon className="animate-spin" aria-hidden /> : <Link2OffIcon aria-hidden />}
      {t("button")}
    </Button>
  );
}

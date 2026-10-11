"use client";

import { MailWarningIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";
import { routes } from "@/lib/routes";
import type { ConfirmationLink } from "@/lib/auth-links";
import { confirmEmailAction } from "@/server/actions/auth";

import { ResendConfirmationForm } from "./resend-confirmation";

/**
 * Confirms the address only when the person presses the button. Mail scanners open links in
 * emails automatically; verifying on page load would let them use up the one-time token.
 */
export function ConfirmEmail({ link }: { link: ConfirmationLink }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "failed">(link ? "idle" : "failed");

  async function confirm() {
    if (!link) return;
    setState("pending");
    const result = await confirmEmailAction(link).catch(() => ({ ok: false as const }));
    if (!result.ok) {
      setState("failed");
      return;
    }
    router.replace(routes.welcome);
    router.refresh();
  }

  if (state === "failed") {
    return (
      <div className="grid gap-6">
        <Alert variant={link ? "destructive" : "default"}>
          <MailWarningIcon aria-hidden />
          {link && <AlertTitle>{t("linkInvalidText")}</AlertTitle>}
          {!link && <AlertDescription>{t("confirmMissingText")}</AlertDescription>}
        </Alert>
        <ResendConfirmationForm />
        <Button asChild variant="ghost">
          <Link href={routes.signIn}>{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <p className="text-sm text-muted-foreground">{t("confirmText")}</p>
      <SubmitButton pending={state === "pending"}>{t("confirmSubmit")}</SubmitButton>
    </form>
  );
}

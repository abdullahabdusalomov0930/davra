"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailSchema } from "@/lib/validators";
import { resendConfirmationAction } from "@/server/actions/auth";

const COOLDOWN_SECONDS = 60;

/** Sends the sign-up confirmation email again, at most once a minute per page. */
function useResendConfirmation() {
  const t = useTranslations("Auth");
  const tError = useTranslations("AuthErrors");
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send(email: string) {
    setPending(true);
    const result = await resendConfirmationAction(email).catch(() => ({
      ok: false as const,
      error: "network" as const,
    }));
    setPending(false);

    if (!result.ok) {
      toast.error(tError(result.error ?? "unknown"));
      return;
    }
    toast.success(t("resent"));
    setCooldown(COOLDOWN_SECONDS);
  }

  const label = cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend");
  return { send, disabled: pending || cooldown > 0, label };
}

/** Resend button for a known address (after sign-up, or when sign-in says it is unconfirmed). */
export function ResendConfirmation({ email }: { email: string }) {
  const { send, disabled, label } = useResendConfirmation();

  return (
    <Button type="button" variant="outline" size="lg" disabled={disabled} onClick={() => send(email)}>
      {label}
    </Button>
  );
}

/** Resend form that asks for the address (for an expired or missing confirmation link). */
export function ResendConfirmationForm() {
  const t = useTranslations("Auth");
  const tValidation = useTranslations("Validation");
  const { send, disabled, label } = useResendConfirmation();
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(new FormData(event.currentTarget).get("email") ?? "");
    if (!parsed.success) {
      setError(tValidation("emailInvalid"));
      return;
    }
    setError(null);
    await send(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-2">
      <Label htmlFor={id}>{t("emailLabel")}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" variant="outline" size="lg" disabled={disabled} className="shrink-0">
          {label}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

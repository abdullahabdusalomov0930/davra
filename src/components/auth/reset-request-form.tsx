"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import type { AuthErrorKey } from "@/lib/auth-errors";
import { type ResetRequestInput, resetRequestSchema } from "@/lib/validators";
import { requestPasswordResetAction } from "@/server/actions/auth";

export function ResetRequestForm() {
  const t = useTranslations("Auth");
  const tError = useTranslations("AuthErrors");
  const errorMessage = useErrorMessage();
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<ResetRequestInput, unknown, z.output<typeof resetRequestSchema>>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFormError(null);
    const result = await requestPasswordResetAction({ email }).catch(() => ({
      ok: false as const,
      error: "network" as const,
    }));
    if (!result.ok) {
      setFormError(result.error ?? "unknown");
      return;
    }
    // Same answer whether or not the address has an account.
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <div className="grid gap-3 text-center" role="status">
        <MailCheckIcon className="mx-auto size-10 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">{t("resetSentTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("resetSentText", { email: sentTo })}</p>
        <p className="text-sm text-muted-foreground">{t("checkEmailHint")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>{tError(formError)}</AlertTitle>
        </Alert>
      )}
      <Field label={t("emailLabel")} error={errorMessage(errors.email)}>
        {(control) => (
          <Input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            {...form.register("email")}
          />
        )}
      </Field>
      <SubmitButton pending={isSubmitting}>{t("resetSubmit")}</SubmitButton>
    </form>
  );
}

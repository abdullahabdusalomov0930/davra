"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Field } from "@/components/forms/field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { type AuthErrorKey, authErrorKey } from "@/lib/auth-errors";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import { type SignInInput, signInSchema } from "@/lib/validators";

import { ResendConfirmation } from "./resend-confirmation";

/** `next` must already be a safe, same-site path (see safeRedirectPath). */
export function SignInForm({ next }: { next: string }) {
  const t = useTranslations("Auth");
  const tError = useTranslations("AuthErrors");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<SignInInput, unknown, z.output<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setUnconfirmedEmail(null);

    const { error } = await createClient().auth.signInWithPassword(values);
    if (error) {
      const key = authErrorKey(error);
      setFormError(key);
      if (key === "emailNotConfirmed") setUnconfirmedEmail(values.email);
      form.setFocus("password");
      return;
    }

    setRedirecting(true);
    router.replace(next);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>{tError(formError)}</AlertTitle>
          {unconfirmedEmail && (
            <AlertDescription>
              <p>{t("notConfirmedText")}</p>
              <ResendConfirmation email={unconfirmedEmail} />
            </AlertDescription>
          )}
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

      <Field
        label={t("passwordLabel")}
        error={errorMessage(errors.password)}
        labelAction={
          <Link href={routes.resetPassword} className="text-sm font-medium text-primary hover:underline">
            {t("forgotPassword")}
          </Link>
        }
      >
        {(control) => (
          <PasswordInput
            {...control}
            autoComplete="current-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            {...form.register("password")}
          />
        )}
      </Field>

      <SubmitButton pending={isSubmitting || redirecting}>{t("signInSubmit")}</SubmitButton>
    </form>
  );
}

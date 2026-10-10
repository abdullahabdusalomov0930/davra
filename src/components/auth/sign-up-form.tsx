"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Field } from "@/components/forms/field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { type AuthErrorKey, authErrorKey } from "@/lib/auth-errors";
import { absoluteUrl, routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import { type SignUpInput, signUpSchema } from "@/lib/validators";

import { ResendConfirmation } from "./resend-confirmation";

export function SignUpForm() {
  const t = useTranslations("Auth");
  const tError = useTranslations("AuthErrors");
  const errorMessage = useErrorMessage();
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<SignUpInput, unknown, z.output<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", username: "", email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const username = useWatch({ control: form.control, name: "username" }).trim().toLowerCase();

  const onSubmit = form.handleSubmit(async ({ displayName, username, email, password }) => {
    setFormError(null);
    const supabase = createClient();

    // Friendly early check; the database stays the authority (it adds a suffix on a race).
    const { data: taken } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
    if (taken) {
      form.setError("username", { message: "usernameTaken" }, { shouldFocus: true });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: absoluteUrl(routes.confirmEmail),
        data: { username, display_name: displayName },
      },
    });
    if (error) {
      setFormError(authErrorKey(error));
      return;
    }
    // Supabase answers the same way for new and already registered addresses, so this message
    // never reveals whether an account exists.
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <div className="grid gap-5 text-center" role="status">
        <MailCheckIcon className="mx-auto size-10 text-primary" aria-hidden />
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold">{t("checkEmailTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("checkEmailText", { email: sentTo })}</p>
          <p className="text-sm text-muted-foreground">{t("checkEmailHint")}</p>
        </div>
        <ResendConfirmation email={sentTo} />
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

      <Field label={t("displayNameLabel")} error={errorMessage(errors.displayName)}>
        {(control) => (
          <Input
            {...control}
            autoComplete="name"
            placeholder={t("displayNamePlaceholder")}
            {...form.register("displayName")}
          />
        )}
      </Field>

      <Field
        label={t("usernameLabel")}
        error={errorMessage(errors.username)}
        hint={t("usernameHint", { username: username || "…" })}
      >
        {(control) => (
          <Input
            {...control}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...form.register("username")}
          />
        )}
      </Field>

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

      <Field label={t("passwordLabel")} error={errorMessage(errors.password)} hint={t("passwordHint")}>
        {(control) => (
          <PasswordInput
            {...control}
            autoComplete="new-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            {...form.register("password")}
          />
        )}
      </Field>

      <SubmitButton pending={isSubmitting}>{t("signUpSubmit")}</SubmitButton>

      <p className="text-center text-xs text-pretty text-muted-foreground">
        {t.rich("termsNotice", {
          rules: (chunks) => (
            <Link href={routes.rules} className="underline underline-offset-2 hover:text-foreground">
              {chunks}
            </Link>
          ),
          terms: (chunks) => (
            <Link href={routes.terms} className="underline underline-offset-2 hover:text-foreground">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}

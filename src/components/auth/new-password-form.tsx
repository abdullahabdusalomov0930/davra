"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Field } from "@/components/forms/field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type AuthErrorKey, authErrorKey } from "@/lib/auth-errors";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import { type NewPasswordInput, newPasswordFormSchema } from "@/lib/validators";

export type RecoveryLink = { tokenHash: string } | { code: string } | null;

/**
 * The recovery token is used only when the new password is submitted (not on page load), so mail
 * scanners that open the link cannot use it up. After a successful check the session exists, so a
 * second attempt (e.g. after "password too weak") only updates the password.
 */
export function NewPasswordForm({ link }: { link: RecoveryLink }) {
  const t = useTranslations("Auth");
  const tError = useTranslations("AuthErrors");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<NewPasswordInput, unknown, z.output<typeof newPasswordFormSchema>>({
    resolver: zodResolver(newPasswordFormSchema),
    defaultValues: { password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  if (!link) {
    return (
      <div className="grid gap-5">
        <Alert>
          <AlertDescription>{t("newPasswordNoLink")}</AlertDescription>
        </Alert>
        <Button asChild size="lg">
          <Link href={routes.resetPassword}>{t("requestNewLink")}</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setFormError(null);
    const supabase = createClient();

    if (!verified) {
      const { error } =
        "code" in link
          ? await supabase.auth.exchangeCodeForSession(link.code)
          : await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: "recovery" });
      if (error) {
        setFormError("linkInvalid");
        return;
      }
      setVerified(true);
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(authErrorKey(error));
      form.setFocus("password");
      return;
    }

    setRedirecting(true);
    toast.success(t("passwordUpdated"));
    router.replace(routes.home);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>{tError(formError)}</AlertTitle>
          {formError === "linkInvalid" && (
            <AlertDescription>
              <Link href={routes.resetPassword} className="font-medium underline underline-offset-2">
                {t("requestNewLink")}
              </Link>
            </AlertDescription>
          )}
        </Alert>
      )}
      <Field label={t("newPasswordLabel")} error={errorMessage(errors.password)} hint={t("passwordHint")}>
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
      <SubmitButton pending={isSubmitting || redirecting}>{t("newPasswordSubmit")}</SubmitButton>
    </form>
  );
}

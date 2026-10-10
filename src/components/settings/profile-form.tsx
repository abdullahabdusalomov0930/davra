"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-result";
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  FIELD_OF_STUDY_MAX_LENGTH,
  type ProfileData,
  type ProfileInput,
  profileSchema,
  UNIVERSITY_MAX_LENGTH,
} from "@/lib/validators";
import { updateProfileAction } from "@/server/actions/profile";

export function ProfileForm({ defaultValues }: { defaultValues: ProfileInput }) {
  const t = useTranslations("Settings");
  const tAuth = useTranslations("Auth");
  const tForm = useTranslations("Form");
  const tAction = useTranslations("ActionErrors");
  const errorMessage = useErrorMessage();

  const form = useForm<ProfileInput, unknown, ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const username = useWatch({ control: form.control, name: "username" }).trim().toLowerCase();
  const bioLength = useWatch({ control: form.control, name: "bio" }).length;

  // Validated in the browser first; the action validates the raw values again on the server.
  const onSubmit = form.handleSubmit(async () => {
    const values = form.getValues();
    const result = await callAction(() => updateProfileAction(values));

    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof ProfileInput, { message: key }, { shouldFocus: true });
      }
      toast.error(tAction(result.error));
      return;
    }

    form.reset(values);
    toast.success(t("saved"));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field label={tAuth("displayNameLabel")} error={errorMessage(errors.displayName)}>
        {(control) => (
          <Input
            {...control}
            autoComplete="name"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            {...form.register("displayName")}
          />
        )}
      </Field>

      <Field
        label={tAuth("usernameLabel")}
        error={errorMessage(errors.username)}
        hint={tAuth("usernameHint", { username: username || "…" })}
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

      <Field
        label={t("bioLabel")}
        optionalLabel={tForm("optional")}
        error={errorMessage(errors.bio)}
        hint={<span aria-live="polite">{tForm("charCount", { count: bioLength, max: BIO_MAX_LENGTH })}</span>}
      >
        {(control) => <Textarea {...control} rows={3} placeholder={t("bioPlaceholder")} {...form.register("bio")} />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("universityLabel")} optionalLabel={tForm("optional")} error={errorMessage(errors.university)}>
          {(control) => (
            <Input
              {...control}
              autoComplete="organization"
              maxLength={UNIVERSITY_MAX_LENGTH}
              placeholder={t("universityPlaceholder")}
              {...form.register("university")}
            />
          )}
        </Field>
        <Field
          label={t("fieldOfStudyLabel")}
          optionalLabel={tForm("optional")}
          error={errorMessage(errors.fieldOfStudy)}
        >
          {(control) => (
            <Input
              {...control}
              maxLength={FIELD_OF_STUDY_MAX_LENGTH}
              placeholder={t("fieldOfStudyPlaceholder")}
              {...form.register("fieldOfStudy")}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end">
        <SubmitButton pending={isSubmitting} disabled={!isDirty}>
          {t("save")}
        </SubmitButton>
      </div>
    </form>
  );
}

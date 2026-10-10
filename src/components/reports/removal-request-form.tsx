"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-result";
import {
  REMOVAL_DETAILS_MAX,
  type RemovalRequestData,
  type RemovalRequestInput,
  removalRequestSchema,
} from "@/lib/validators";
import { submitRemovalRequestAction } from "@/server/actions/reports";

export function RemovalRequestForm({ defaultUrl }: { defaultUrl?: string }) {
  const t = useTranslations("RemovalRequest");
  const tForm = useTranslations("Form");
  const tAction = useTranslations("ActionErrors");
  const errorMessage = useErrorMessage();
  const [sent, setSent] = useState(false);

  const form = useForm<RemovalRequestInput, unknown, RemovalRequestData>({
    resolver: zodResolver(removalRequestSchema),
    defaultValues: { resourceUrl: defaultUrl ?? "", requesterName: "", requesterEmail: "", details: "", website: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const detailsLength = useWatch({ control: form.control, name: "details" }).length;

  const onSubmit = form.handleSubmit(async () => {
    const values = form.getValues();
    const result = await callAction(() => submitRemovalRequestAction(values));
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof RemovalRequestInput, { message: key });
      }
      toast.error(tAction(result.error));
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <Alert variant="success" role="status">
        <CheckCircle2Icon aria-hidden />
        <AlertTitle>{t("sentTitle")}</AlertTitle>
        <AlertDescription>{t("sentText")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field label={t("url")} hint={t("urlHint")} error={errorMessage(errors.resourceUrl)}>
        {(control) => (
          <Input {...control} type="url" inputMode="url" placeholder="https://…" {...form.register("resourceUrl")} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("name")} error={errorMessage(errors.requesterName)}>
          {(control) => <Input {...control} autoComplete="name" maxLength={100} {...form.register("requesterName")} />}
        </Field>
        <Field label={t("email")} hint={t("emailHint")} error={errorMessage(errors.requesterEmail)}>
          {(control) => <Input {...control} type="email" autoComplete="email" {...form.register("requesterEmail")} />}
        </Field>
      </div>
      <Field
        label={t("details")}
        error={errorMessage(errors.details)}
        hint={<span aria-live="polite">{tForm("charCount", { count: detailsLength, max: REMOVAL_DETAILS_MAX })}</span>}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={6}
            maxLength={REMOVAL_DETAILS_MAX}
            placeholder={t("detailsPlaceholder")}
            {...form.register("details")}
          />
        )}
      </Field>

      {/* Honeypot: invisible to people and screen readers, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {t("honeypot")}
          <input type="text" tabIndex={-1} autoComplete="off" {...form.register("website")} />
        </label>
      </div>

      <div className="grid gap-1.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...form.register("confirm")} />
          {t("confirm")}
        </label>
        {errors.confirm && <p className="text-sm text-destructive">{errorMessage(errors.confirm)}</p>}
      </div>

      <div className="flex justify-end">
        <SubmitButton pending={isSubmitting}>{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FlagIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-result";
import { routes } from "@/lib/routes";
import { REPORT_DETAILS_MAX, REPORT_REASONS, type ReportData, type ReportInput, reportSchema } from "@/lib/validators";
import { reportAction } from "@/server/actions/reports";

type ReportButtonProps = {
  target: { type: "resource" | "comment" | "user"; id: string };
  /** null for guests: the button then leads to sign-in and back to `returnTo`. */
  signedIn: boolean;
  returnTo: string;
  /** Icon only (comments) or icon and text. */
  compact?: boolean;
};

/** "Shikoyat": pick a reason, add an optional note. Reporters stay anonymous to everyone but staff. */
export function ReportButton({ target, signedIn, returnTo, compact = false }: ReportButtonProps) {
  const t = useTranslations("Reports");
  const tReason = useTranslations("ReportReason");
  const tAction = useTranslations("ActionErrors");
  const tForm = useTranslations("Form");
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);

  const form = useForm<ReportInput, unknown, ReportData>({
    resolver: zodResolver(reportSchema),
    defaultValues: { targetType: target.type, targetId: target.id, details: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const label = t(target.type);
  const trigger = (
    <Button
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      className="text-muted-foreground hover:text-foreground"
      aria-label={compact ? label : undefined}
      title={label}
    >
      <FlagIcon aria-hidden />
      {!compact && t("button")}
    </Button>
  );

  if (!signedIn) {
    return (
      <Button
        asChild
        variant="ghost"
        size={compact ? "icon-sm" : "sm"}
        className="text-muted-foreground hover:text-foreground"
      >
        <Link href={routes.signInTo(returnTo)} aria-label={t("signIn")} title={t("signIn")}>
          <FlagIcon aria-hidden />
          {!compact && t("button")}
        </Link>
      </Button>
    );
  }

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => reportAction(form.getValues()));
    if (!result.ok) {
      if (result.fieldErrors?.reason) form.setError("reason", { message: result.fieldErrors.reason });
      toast.error(tAction(result.error));
      return;
    }
    toast.success(t("sent"));
    form.reset();
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && setOpen(next)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={tForm("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <Controller
            control={form.control}
            name="reason"
            render={({ field }) => (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">{t("reason")}</legend>
                {REPORT_REASONS.map((reason) => (
                  <label key={reason} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="radio"
                      name={field.name}
                      value={reason}
                      checked={field.value === reason}
                      onChange={() => field.onChange(reason)}
                      className="size-4 accent-primary"
                    />
                    {tReason(reason)}
                  </label>
                ))}
                {errors.reason && <p className="text-sm text-destructive">{errorMessage(errors.reason)}</p>}
              </fieldset>
            )}
          />
          <Field label={t("details")} optionalLabel={tForm("optional")} error={errorMessage(errors.details)}>
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                maxLength={REPORT_DETAILS_MAX}
                placeholder={t("detailsPlaceholder")}
                {...form.register("details")}
              />
            )}
          </Field>
          <p className="text-xs text-muted-foreground">
            <Link href={routes.removalRequest} className="underline underline-offset-4 hover:text-foreground">
              {t("copyrightHint")}
            </Link>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={isSubmitting}>
              {t("cancel")}
            </Button>
            <SubmitButton pending={isSubmitting}>{t("submit")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

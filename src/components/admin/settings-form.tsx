"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { callAction } from "@/lib/action-result";
import { INTERSTITIAL_MODES, type SettingsData, type SettingsInput, settingsSchema } from "@/lib/validators";
import { updateSettingsAction } from "@/server/actions/moderation";
import { APP_NAME } from "@/lib/config";

/** Auto-hide thresholds and when links open the "you are leaving" page (admins). */
export function SettingsForm({ values }: { values: SettingsInput }) {
  const t = useTranslations("Admin.settings");
  const tAction = useTranslations("ActionErrors");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const form = useForm<SettingsInput, unknown, SettingsData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: values,
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await callAction(() => updateSettingsAction(data));
    if (!result.ok) {
      toast.error(tAction(result.error));
      return;
    }
    toast.success(t("saved"));
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:max-w-xl">
      <Field label={t("threshold")} hint={t("thresholdHint")} error={errorMessage(errors.report_hide_threshold)}>
        {(control) => (
          <Input
            {...control}
            type="number"
            step="0.25"
            min={0.5}
            max={20}
            {...form.register("report_hide_threshold", { valueAsNumber: true })}
          />
        )}
      </Field>
      <Field label={t("thresholdUrgent")} error={errorMessage(errors.report_hide_threshold_urgent)}>
        {(control) => (
          <Input
            {...control}
            type="number"
            step="0.25"
            min={0.5}
            max={20}
            {...form.register("report_hide_threshold_urgent", { valueAsNumber: true })}
          />
        )}
      </Field>
      <Field label={t("interstitial")} error={errorMessage(errors.interstitial_mode)}>
        {(control) => (
          <NativeSelect {...control} {...form.register("interstitial_mode")}>
            {INTERSTITIAL_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`interstitialModes.${mode}`, { appName: APP_NAME })}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <div>
        <SubmitButton pending={isSubmitting} size="default">
          {t("save")}
        </SubmitButton>
      </div>
    </form>
  );
}

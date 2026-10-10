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
import { callAction } from "@/lib/action-result";
import { type BlockedDomainData, type BlockedDomainInput, blockedDomainSchema } from "@/lib/validators";
import { addDomainAction } from "@/server/actions/moderation";

export function DomainForm() {
  const t = useTranslations("Admin");
  const tAction = useTranslations("ActionErrors");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const form = useForm<BlockedDomainInput, unknown, BlockedDomainData>({
    resolver: zodResolver(blockedDomainSchema),
    defaultValues: { domain: "", reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => addDomainAction(form.getValues()));
    if (!result.ok) {
      if (result.fieldErrors?.domain) form.setError("domain", { message: result.fieldErrors.domain });
      toast.error(tAction(result.error));
      return;
    }
    toast.success(t("domains.added"));
    form.reset();
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid items-start gap-3 sm:grid-cols-[1fr_2fr_auto]">
      <Field label={t("domains.domain")} error={errorMessage(errors.domain)}>
        {(control) => (
          <Input
            {...control}
            placeholder="spam.example.com"
            autoCapitalize="none"
            spellCheck={false}
            {...form.register("domain")}
          />
        )}
      </Field>
      <Field label={t("domains.reason")} error={errorMessage(errors.reason)}>
        {(control) => <Input {...control} maxLength={200} {...form.register("reason")} />}
      </Field>
      <SubmitButton pending={isSubmitting} size="default" className="sm:mt-6">
        {t("domains.add")}
      </SubmitButton>
    </form>
  );
}

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
import { type BlockedTermData, type BlockedTermInput, blockedTermSchema, TERM_CATEGORIES } from "@/lib/validators";
import { addTermAction } from "@/server/actions/moderation";

/** Adds a word or phrase to the word filter, on top of the built-in starter lists (admins). */
export function TermForm() {
  const t = useTranslations("Admin.settings");
  const tAction = useTranslations("ActionErrors");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const form = useForm<BlockedTermInput, unknown, BlockedTermData>({
    resolver: zodResolver(blockedTermSchema),
    defaultValues: { term: "", category: "scam" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await callAction(() => addTermAction(data));
    if (!result.ok) {
      if (result.fieldErrors?.term) form.setError("term", { message: result.fieldErrors.term });
      toast.error(tAction(result.error));
      return;
    }
    form.reset({ term: "", category: data.category });
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid items-start gap-3 sm:grid-cols-[2fr_1fr_auto]">
      <Field label={t("term")} error={errorMessage(errors.term)}>
        {(control) => <Input {...control} maxLength={80} autoCapitalize="none" {...form.register("term")} />}
      </Field>
      <Field label={t("category")} error={errorMessage(errors.category)}>
        {(control) => (
          <NativeSelect {...control} {...form.register("category")}>
            {TERM_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`categories.${category}`)}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <SubmitButton pending={isSubmitting} size="default" className="sm:mt-6">
        {t("add")}
      </SubmitButton>
    </form>
  );
}

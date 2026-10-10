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
import { type TopicData, type TopicInput, topicSchema } from "@/lib/validators";
import { createTopicAction, updateTopicAction } from "@/server/actions/moderation";

/** Create a topic, or edit one when `topicId` is given. */
export function TopicForm({ topicId, defaultValues }: { topicId?: string; defaultValues?: TopicInput }) {
  const t = useTranslations("Admin");
  const tAction = useTranslations("ActionErrors");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const form = useForm<TopicInput, unknown, TopicData>({
    resolver: zodResolver(topicSchema),
    defaultValues: defaultValues ?? { slug: "", nameUz: "", descriptionUz: "", sortOrder: 100 },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async () => {
    const values = form.getValues();
    const result = await callAction(() => (topicId ? updateTopicAction(topicId, values) : createTopicAction(values)));
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof TopicInput, { message: key });
      }
      toast.error(tAction(result.error));
      return;
    }
    toast.success(topicId ? t("topics.saved") : t("topics.created"));
    form.reset(topicId ? values : undefined);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
      <Field label={t("topics.name")} error={errorMessage(errors.nameUz)}>
        {(control) => <Input {...control} maxLength={60} {...form.register("nameUz")} />}
      </Field>
      <Field label={t("topics.slug")} error={errorMessage(errors.slug)}>
        {(control) => (
          <Input {...control} maxLength={60} autoCapitalize="none" spellCheck={false} {...form.register("slug")} />
        )}
      </Field>
      <Field label={t("topics.sortOrder")} error={errorMessage(errors.sortOrder)}>
        {(control) => (
          <Input
            {...control}
            type="number"
            min={0}
            max={10000}
            {...form.register("sortOrder", { valueAsNumber: true })}
          />
        )}
      </Field>
      <div className="sm:col-span-3">
        <Field label={t("topics.description")} error={errorMessage(errors.descriptionUz)}>
          {(control) => <Input {...control} maxLength={300} {...form.register("descriptionUz")} />}
        </Field>
      </div>
      <div className="flex justify-end sm:col-span-3">
        <SubmitButton pending={isSubmitting} disabled={Boolean(topicId) && !isDirty} size="default">
          {topicId ? t("topics.save") : t("topics.create")}
        </SubmitButton>
      </div>
    </form>
  );
}

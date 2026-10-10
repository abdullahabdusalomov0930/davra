"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-result";
import { COMMENT_MAX, type CommentData, type CommentInput, commentSchema } from "@/lib/validators";
import { addCommentAction } from "@/server/actions/interactions";

export function CommentForm({ resourceId }: { resourceId: string }) {
  const t = useTranslations("Comments");
  const tForm = useTranslations("Form");
  const tAction = useTranslations("ActionErrors");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const form = useForm<CommentInput, unknown, CommentData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const length = useWatch({ control: form.control, name: "body" }).length;

  const onSubmit = form.handleSubmit(async () => {
    const values = form.getValues();
    const result = await callAction(() => addCommentAction(resourceId, values));
    if (!result.ok) {
      if (result.fieldErrors?.body) form.setError("body", { message: result.fieldErrors.body });
      toast.error(tAction(result.error));
      return;
    }
    form.reset({ body: "" });
    toast.success(t(result.pending ? "addedPending" : "added"));
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3">
      <Field
        label={t("label")}
        error={errorMessage(errors.body)}
        hint={<span aria-live="polite">{tForm("charCount", { count: length, max: COMMENT_MAX })}</span>}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={COMMENT_MAX}
            placeholder={t("placeholder")}
            {...form.register("body")}
          />
        )}
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={isSubmitting}>{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}

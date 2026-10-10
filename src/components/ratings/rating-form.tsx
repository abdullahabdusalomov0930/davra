"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import { InfoIcon, StarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/components/forms/confirm-action";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-result";
import { type RatingData, type RatingInput, ratingSchema, REVIEW_MAX } from "@/lib/validators";
import { deleteRatingAction, saveRatingAction } from "@/server/actions/interactions";

type RatingFormProps = {
  resourceId: string;
  current: { stars: number; reviewText: string; countsInAverage: boolean } | null;
};

/** The viewer's own rating: 1–5 stars (a native radio group) and an optional short review. */
export function RatingForm({ resourceId, current }: RatingFormProps) {
  const t = useTranslations("Ratings");
  const tForm = useTranslations("Form");
  const tAction = useTranslations("ActionErrors");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [hovered, setHovered] = useState(0);

  const form = useForm<RatingInput, unknown, RatingData>({
    resolver: zodResolver(ratingSchema),
    defaultValues: { stars: current?.stars ?? 0, reviewText: current?.reviewText ?? "" },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const stars = useWatch({ control: form.control, name: "stars" });
  const reviewLength = useWatch({ control: form.control, name: "reviewText" }).length;

  const onSubmit = form.handleSubmit(async () => {
    const values = form.getValues();
    const result = await callAction(() => saveRatingAction(resourceId, values));
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof RatingInput, { message: key });
      }
      toast.error(tAction(result.error));
      return;
    }
    form.reset(values);
    toast.success(t("saved"));
    router.refresh();
  });

  async function onDelete() {
    const result = await callAction(() => deleteRatingAction(resourceId));
    if (!result.ok) {
      toast.error(tAction(result.error));
      return false;
    }
    form.reset({ stars: 0, reviewText: "" });
    toast.success(t("deleted"));
    router.refresh();
    return true;
  }

  const shown = hovered || stars;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Controller
        control={form.control}
        name="stars"
        render={({ field }) => (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("yourRating")}</legend>
            <div className="flex w-fit gap-1" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className="cursor-pointer rounded-md p-0.5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  onMouseEnter={() => setHovered(value)}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={value}
                    checked={field.value === value}
                    onChange={() => field.onChange(value)}
                    className="sr-only"
                  />
                  <StarIcon
                    aria-hidden
                    className={cn(
                      "size-8 transition-colors",
                      value <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                    )}
                  />
                  <span className="sr-only">{t("star", { count: value })}</span>
                </label>
              ))}
            </div>
            {errors.stars && <p className="text-sm text-destructive">{errorMessage(errors.stars)}</p>}
          </fieldset>
        )}
      />

      <Field
        label={t("reviewLabel")}
        optionalLabel={tForm("optional")}
        error={errorMessage(errors.reviewText)}
        hint={<span aria-live="polite">{tForm("charCount", { count: reviewLength, max: REVIEW_MAX })}</span>}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={REVIEW_MAX}
            placeholder={t("reviewPlaceholder")}
            {...form.register("reviewText")}
          />
        )}
      </Field>

      {current && !current.countsInAverage && (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertDescription>{t("notCounted")}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {current && (
          <ConfirmAction
            title={t("deleteTitle")}
            description={t("deleteText")}
            confirmLabel={t("deleteConfirm")}
            cancelLabel={t("cancel")}
            onConfirm={onDelete}
          >
            <Button type="button" variant="ghost" size="lg">
              {t("delete")}
            </Button>
          </ConfirmAction>
        )}
        <SubmitButton pending={isSubmitting} disabled={!isDirty}>
          {t("submit")}
        </SubmitButton>
      </div>
    </form>
  );
}

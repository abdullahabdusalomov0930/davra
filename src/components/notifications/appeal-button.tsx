"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ScaleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { APPEAL_MAX, type AppealData, type AppealInput, appealSchema } from "@/lib/validators";
import { appealAction } from "@/server/actions/notifications";

/** "Eʼtiroz bildirish": once per hidden resource or comment, or per ban. */
export function AppealButton({
  targetType,
  targetId,
  size = "sm",
}: {
  targetType: "resource" | "comment" | "ban";
  targetId: string;
  size?: "sm" | "default";
}) {
  const t = useTranslations("Appeal");
  const tAction = useTranslations("ActionErrors");
  const tForm = useTranslations("Form");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<AppealInput, unknown, AppealData>({
    resolver: zodResolver(appealSchema),
    defaultValues: { targetType, targetId, message: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => appealAction(form.getValues()));
    if (!result.ok) {
      if (result.fieldErrors?.message) form.setError("message", { message: result.fieldErrors.message });
      toast.error(tAction(result.error));
      return;
    }
    toast.success(t("sent"));
    setOpen(false);
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={size}>
          <ScaleIcon aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tForm("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label={t("label")} error={errorMessage(errors.message)}>
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                maxLength={APPEAL_MAX}
                placeholder={t("placeholder")}
                {...form.register("message")}
              />
            )}
          </Field>
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

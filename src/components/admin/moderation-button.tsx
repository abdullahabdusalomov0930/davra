"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ComponentProps, type ReactNode, useId, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type ActionResult, callAction } from "@/lib/action-result";
import {
  MODERATION_REASON_MAX,
  MODERATION_RULES,
  type ModerationInput,
  type ModerationRule,
  type ValidationKey,
} from "@/lib/validators";

type Result = ActionResult<string>;

type ModerationButtonProps = {
  /**
   * A Server Action bound to everything but the moderation input, e.g.
   * `moderateResourceAction.bind(null, id, "hidden")`. With `choices`, it also receives the choice
   * first: `banUserAction.bind(null, userId)` → (length, input).
   */
  action: ((input: ModerationInput) => Promise<Result>) | ((choice: string, input: ModerationInput) => Promise<Result>);
  children: ReactNode;
  title: string;
  description?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  /** Prefilled reason, e.g. "Qoidalarga mos." for an approval. */
  defaultReason?: string;
  /** Ask for the rule of /qoidalar that applies (taking content down, bans, warnings). */
  withRule?: boolean;
  defaultRule?: ModerationRule;
  /** A choice to make as well, e.g. the length of a ban. */
  choices?: { label: string; options: { value: string; label: string }[]; hint?: string };
  /** Toast on success. */
  success?: string;
  className?: string;
};

/**
 * One moderation action. Every action needs a reason (D71): it is shown to the person concerned and
 * kept in the audit log, so the dialog asks for it before running the action.
 */
export function ModerationButton({
  action,
  children,
  title,
  description,
  variant = "outline",
  defaultReason = "",
  withRule = false,
  defaultRule,
  choices,
  success,
  className,
}: ModerationButtonProps) {
  const t = useTranslations("Admin");
  const tRule = useTranslations("Rules");
  const tAction = useTranslations("ActionErrors");
  const tValidation = useTranslations("Validation");
  const router = useRouter();
  const choiceId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState(defaultReason);
  const [rule, setRule] = useState<ModerationRule | "">(defaultRule ?? "");
  const [choice, setChoice] = useState(choices?.options[0]?.value ?? "");
  const [error, setError] = useState<ValidationKey | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const input: ModerationInput = { reason, rule: rule || null };
    const result = await callAction(() =>
      choices
        ? (action as (choice: string, input: ModerationInput) => Promise<Result>)(choice, input)
        : (action as (input: ModerationInput) => Promise<Result>)(input),
    );
    setPending(false);
    if (!result.ok) {
      const fieldError = result.fieldErrors?.reason ?? null;
      setError(fieldError);
      if (!fieldError) toast.error(tAction(result.error));
      return;
    }
    toast.success(success ?? t("done"));
    setOpen(false);
    setError(null);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size="sm" className={className}>
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("moderation.cancel")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          {choices && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{choices.label}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {choices.options.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={choiceId}
                      value={option.value}
                      checked={choice === option.value}
                      onChange={() => setChoice(option.value)}
                      className="size-4 accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {choices.hint && <p className="text-xs text-muted-foreground">{choices.hint}</p>}
            </fieldset>
          )}
          {withRule && (
            <Field label={t("moderation.ruleLabel")}>
              {(control) => (
                <NativeSelect
                  {...control}
                  value={rule}
                  onChange={(event) => setRule(event.target.value as ModerationRule)}
                >
                  <option value="">{t("moderation.ruleNone")}</option>
                  {MODERATION_RULES.map((value) => (
                    <option key={value} value={value}>
                      {tRule(value)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          )}
          <Field
            label={t("moderation.reasonLabel")}
            hint={t("moderation.reasonHint")}
            error={error ? tValidation(error) : undefined}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                maxLength={MODERATION_REASON_MAX}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={pending}>
              {t("moderation.cancel")}
            </Button>
            <SubmitButton pending={pending}>{t("moderation.submit")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

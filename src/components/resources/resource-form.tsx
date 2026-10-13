"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CopyIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ChangeEvent, type FocusEvent, type ReactNode, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-result";
import { routes } from "@/lib/routes";
import {
  AUTHOR_REVIEW_MAX,
  FOR_WHOM_MAX,
  RESOURCE_LANGUAGES,
  RESOURCE_LEVELS,
  RESOURCE_PRICES,
  RESOURCE_TYPES,
  type ResourceData,
  type ResourceInput,
  resourceSchema,
  SUMMARY_MAX,
  TITLE_MAX,
} from "@/lib/validators";
import { checkResourceUrlAction, createResourceAction, updateResourceAction } from "@/server/actions/resources";
import type { ResourceStatus } from "@/server/services/resources";

import { RESOURCE_TYPE_ICONS } from "./resource-meta";

type Topic = { id: string; name_uz: string };

type ResourceFormProps = {
  topics: readonly Topic[];
  /** The card being edited; without it the form creates a new one. */
  resource?: { id: string; slug: string; status: ResourceStatus; values: ResourceInput };
  /** New members prove they are not a bot (Cloudflare Turnstile, when configured). */
  withCaptcha?: boolean;
};

/** A link that is already shared: the existing card's slug when the author may open it. */
type Duplicate = { slug?: string };

function FormSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-5 rounded-2xl border-2 border-foreground bg-card p-5 text-card-foreground shadow-hard sm:p-6"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ResourceForm({ topics, resource, withCaptcha = false }: ResourceFormProps) {
  const [captcha, setCaptcha] = useState<string | null>(null);
  const t = useTranslations("ResourceForm");
  const tForm = useTranslations("Form");
  const tAction = useTranslations("ActionErrors");
  const tType = useTranslations("ResourceType");
  const tLanguage = useTranslations("ResourceLanguage");
  const tPrice = useTranslations("ResourcePrice");
  const tLevel = useTranslations("ResourceLevel");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const form = useForm<ResourceInput, unknown, ResourceData>({
    resolver: zodResolver(resourceSchema),
    defaultValues: resource?.values ?? { url: "", title: "", topicId: "", summary: "", forWhom: "", authorReview: "" },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const [titleLength, summaryLength, forWhomLength, reviewLength] = useWatch({
    control: form.control,
    name: ["title", "summary", "forWhom", "authorReview"],
  }).map((value) => value?.length ?? 0);

  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [checkingUrl, setCheckingUrl] = useState(false);
  const latestCheck = useRef(0);

  function showDuplicate(found: Duplicate) {
    setDuplicate(found);
    form.setError("url", { message: "urlDuplicate" });
  }

  /** Early, friendly duplicate check when the link field loses focus; the server checks again on save. */
  async function checkUrl(value: string) {
    const check = ++latestCheck.current;
    if (!value.trim()) return;

    setCheckingUrl(true);
    const result = await checkResourceUrlAction(value, resource?.id).catch(() => null);
    if (check !== latestCheck.current) return;
    setCheckingUrl(false);

    if (!result || result.status === "invalid") return;
    // Show the link as it will be saved (https added, tracking parameters removed).
    if (result.url !== value) form.setValue("url", result.url, { shouldDirty: true });
    if (result.status === "duplicate") showDuplicate({ slug: result.slug });
  }

  const onSubmit = form.handleSubmit(async () => {
    const values = form.getValues();
    const result = await callAction(() =>
      resource ? updateResourceAction(resource.id, values) : createResourceAction(values, captcha),
    );

    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof ResourceInput, { message: key }, { shouldFocus: true });
      }
      if (result.fieldErrors?.url === "urlDuplicate") showDuplicate({ slug: result.duplicateSlug });
      toast.error(tAction(result.error));
      return;
    }

    if (!resource) {
      toast.success(result.status === "published" ? t("createdPublished") : t("createdPending"));
    } else {
      const backInQueue = resource.status === "published" && result.status === "pending";
      toast.success(backInQueue ? t("savedPending") : t("saved"));
    }
    form.reset(values);
    router.push(routes.resource(result.slug));
  });

  const urlField = form.register("url");

  function onUrlChange(event: ChangeEvent<HTMLInputElement>) {
    void urlField.onChange(event);
    // A pending check is about the old text; a shown duplicate no longer applies.
    latestCheck.current++;
    setCheckingUrl(false);
    if (duplicate) {
      setDuplicate(null);
      form.clearErrors("url");
    }
  }

  function onUrlBlur(event: FocusEvent<HTMLInputElement>) {
    void urlField.onBlur(event);
    void checkUrl(event.target.value);
  }

  const counter = (count: number, max: number) => <span aria-live="polite">{tForm("charCount", { count, max })}</span>;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <FormSection id="resource-link" title={t("sectionLink")}>
        <Field
          label={t("urlLabel")}
          // The duplicate notice below says it better than the one-line field error.
          error={duplicate ? undefined : errorMessage(errors.url)}
          hint={
            checkingUrl ? (
              <span className="inline-flex items-center gap-1.5" role="status">
                <Loader2Icon className="size-3 animate-spin" aria-hidden />
                {t("urlChecking")}
              </span>
            ) : (
              t("urlHint")
            )
          }
        >
          {(control) => (
            <Input
              {...control}
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t("urlPlaceholder")}
              {...urlField}
              onChange={onUrlChange}
              onBlur={onUrlBlur}
            />
          )}
        </Field>

        {duplicate && (
          <Alert role="status">
            <CopyIcon aria-hidden />
            <AlertTitle>{t("duplicateTitle")}</AlertTitle>
            <AlertDescription className="grid gap-3">
              <p>{duplicate.slug ? t("duplicateText") : t("duplicatePendingText")}</p>
              {duplicate.slug && (
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <Link href={routes.resource(duplicate.slug)}>{t("duplicateOpen")}</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Field label={t("titleLabel")} error={errorMessage(errors.title)} hint={counter(titleLength, TITLE_MAX)}>
          {(control) => (
            <Input {...control} maxLength={TITLE_MAX} placeholder={t("titlePlaceholder")} {...form.register("title")} />
          )}
        </Field>
      </FormSection>

      <FormSection id="resource-about" title={t("sectionAbout")}>
        <Field label={t("topicLabel")} error={errorMessage(errors.topicId)}>
          {(control) => (
            <NativeSelect {...control} {...form.register("topicId")}>
              <option value="">{t("topicPlaceholder")}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name_uz}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <ChoiceChips
          legend={t("typeLabel")}
          options={RESOURCE_TYPES.map((value) => ({ value, label: tType(value), icon: RESOURCE_TYPE_ICONS[value] }))}
          registration={form.register("type")}
          error={errorMessage(errors.type)}
        />
        <ChoiceChips
          legend={t("languageLabel")}
          options={RESOURCE_LANGUAGES.map((value) => ({ value, label: tLanguage(value) }))}
          registration={form.register("language")}
          error={errorMessage(errors.language)}
        />
        <ChoiceChips
          legend={t("priceLabel")}
          options={RESOURCE_PRICES.map((value) => ({ value, label: tPrice(value) }))}
          registration={form.register("price")}
          error={errorMessage(errors.price)}
        />
        <ChoiceChips
          legend={t("levelLabel")}
          options={RESOURCE_LEVELS.map((value) => ({ value, label: tLevel(value) }))}
          registration={form.register("level")}
          error={errorMessage(errors.level)}
        />
      </FormSection>

      <FormSection id="resource-description" title={t("sectionDescription")}>
        <Field
          label={t("summaryLabel")}
          error={errorMessage(errors.summary)}
          hint={counter(summaryLength, SUMMARY_MAX)}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={5}
              maxLength={SUMMARY_MAX}
              placeholder={t("summaryPlaceholder")}
              {...form.register("summary")}
            />
          )}
        </Field>
        <Field
          label={t("forWhomLabel")}
          error={errorMessage(errors.forWhom)}
          hint={counter(forWhomLength, FOR_WHOM_MAX)}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              maxLength={FOR_WHOM_MAX}
              placeholder={t("forWhomPlaceholder")}
              {...form.register("forWhom")}
            />
          )}
        </Field>
        <Field
          label={t("authorReviewLabel")}
          optionalLabel={tForm("optional")}
          error={errorMessage(errors.authorReview)}
          hint={counter(reviewLength, AUTHOR_REVIEW_MAX)}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={4}
              maxLength={AUTHOR_REVIEW_MAX}
              placeholder={t("authorReviewPlaceholder")}
              {...form.register("authorReview")}
            />
          )}
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost" size="lg">
          <Link href={resource ? routes.resource(resource.slug) : routes.home}>{t("cancel")}</Link>
        </Button>
        {withCaptcha && <Turnstile onToken={setCaptcha} />}
        <SubmitButton pending={isSubmitting} disabled={Boolean(resource) && !isDirty}>
          {resource ? t("submitEdit") : t("submitCreate")}
        </SubmitButton>
      </div>
    </form>
  );
}

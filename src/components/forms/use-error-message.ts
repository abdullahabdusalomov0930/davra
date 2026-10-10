"use client";

import { useTranslations } from "next-intl";

import type { ValidationKey } from "@/lib/validators";

/** Translates the key a Zod schema put into a form error. */
export function useErrorMessage() {
  const t = useTranslations("Validation");

  return (error: { message?: string } | undefined): string | undefined => {
    const key = error?.message;
    if (!key) return undefined;
    return t.has(key as ValidationKey) ? t(key as ValidationKey) : t("required");
  };
}

import "server-only";

import type { z } from "zod";

import messages from "../../../messages/uz.json";
import type { ValidationKey } from "@/lib/validators";

const VALIDATION_KEYS = new Set(Object.keys(messages.Validation));

/**
 * First error per top-level field, as translation keys. Our schemas only emit keys; anything else
 * (e.g. a wrong type from a tampered request) falls back to "required".
 */
export function toFieldErrors<Field extends string>(error: z.ZodError): Partial<Record<Field, ValidationKey>> {
  const fieldErrors: Partial<Record<string, ValidationKey>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || field in fieldErrors) continue;
    fieldErrors[field] = VALIDATION_KEYS.has(issue.message) ? (issue.message as ValidationKey) : "required";
  }
  return fieldErrors as Partial<Record<Field, ValidationKey>>;
}

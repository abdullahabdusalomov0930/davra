import "server-only";

import type { ActionErrorKey } from "@/lib/action-result";

export type DbError = { code?: string; message: string; details?: string | null };

const RATE_LIMIT_ERRORS: Record<string, ActionErrorKey> = {
  resource: "rateLimitedResources",
  comment: "rateLimitedComments",
  like_or_save: "rateLimitedLikes",
  report: "rateLimitedReports",
};

/** The message for a database rate-limit refusal (`rate_limited`, D52), or null for other errors. */
export function rateLimitError(error: DbError): ActionErrorKey | null {
  if (error.code !== "P0001" || error.message !== "rate_limited") return null;
  return RATE_LIMIT_ERRORS[error.details ?? ""] ?? "rateLimited";
}

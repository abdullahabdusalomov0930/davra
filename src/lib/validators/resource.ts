import { z } from "@/lib/zod";

import { cleanText } from "@/lib/clean-text";
import { normalizeUrl } from "@/lib/url-normalize";
import { Constants } from "@/types/database";

import { message, type ValidationKey } from "./messages";

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const SUMMARY_MIN = 40;
export const SUMMARY_MAX = 500;
export const FOR_WHOM_MIN = 10;
export const FOR_WHOM_MAX = 200;
export const AUTHOR_REVIEW_MAX = 600;

export const RESOURCE_TYPES = Constants.public.Enums.resource_type;
export const RESOURCE_LANGUAGES = Constants.public.Enums.resource_language;
export const RESOURCE_PRICES = Constants.public.Enums.resource_price;
export const RESOURCE_LEVELS = Constants.public.Enums.resource_level;

const EMOJI = /\p{Extended_Pictographic}/gu;
const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)\S+/gi;

export function emojiCount(text: string): number {
  return text.match(EMOJI)?.length ?? 0;
}

/** "PYTHON ASOSLARI BEPUL" is shouting; short acronyms ("IELTS", "MIT OCW") are fine. */
export function isAllCaps(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  const cased = letters.filter((letter) => letter.toLowerCase() !== letter.toUpperCase());
  return cased.length >= 10 && cased.every((letter) => letter === letter.toUpperCase());
}

/** Text left after removing links: a summary must be the author's own words, not a pasted URL. */
export function withoutUrls(text: string): string {
  return text.replace(URL_IN_TEXT, " ").replace(/\s+/g, " ").trim();
}

/** A text cleaned first (cleanText: invisible characters, spaces, Unicode forms), then measured. */
function text(min: number, max: number, tooShort: ValidationKey, tooLong: ValidationKey, multiline = false) {
  return z
    .string()
    .transform((value) => cleanText(value, { multiline }))
    .pipe(z.string().min(min, message(tooShort)).max(max, message(tooLong)));
}

const maxEmoji = (limit: number) => (value: string) => emojiCount(value) <= limit;

export const resourceUrlSchema = z
  .string()
  .trim()
  .min(1, message("required"))
  .transform((value, ctx) => {
    const result = normalizeUrl(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error satisfies ValidationKey });
      return z.NEVER;
    }
    return result.url;
  });

export const resourceSchema = z.strictObject({
  url: resourceUrlSchema,
  title: text(TITLE_MIN, TITLE_MAX, "titleTooShort", "titleTooLong")
    .refine((value) => !isAllCaps(value), message("titleAllCaps"))
    .refine(maxEmoji(2), message("tooManyEmoji")),
  topicId: z.uuid(message("topicRequired")),
  type: z.enum(RESOURCE_TYPES, message("required")),
  language: z.enum(RESOURCE_LANGUAGES, message("required")),
  price: z.enum(RESOURCE_PRICES, message("required")),
  level: z.enum(RESOURCE_LEVELS, message("required")),
  summary: text(SUMMARY_MIN, SUMMARY_MAX, "summaryTooShort", "summaryTooLong", true)
    .refine((value) => withoutUrls(value).length >= SUMMARY_MIN, message("summaryOnlyUrl"))
    .refine(maxEmoji(5), message("tooManyEmoji")),
  forWhom: text(FOR_WHOM_MIN, FOR_WHOM_MAX, "forWhomTooShort", "forWhomTooLong").refine(
    maxEmoji(5),
    message("tooManyEmoji"),
  ),
  authorReview: text(0, AUTHOR_REVIEW_MAX, "authorReviewTooLong", "authorReviewTooLong", true)
    .refine(maxEmoji(5), message("tooManyEmoji"))
    .transform((value) => (value === "" ? null : value)),
});

export type ResourceInput = z.input<typeof resourceSchema>;
export type ResourceData = z.output<typeof resourceSchema>;

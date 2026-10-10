import { z } from "@/lib/zod";

import { cleanText } from "@/lib/clean-text";
import { Constants } from "@/types/database";

import { message } from "./messages";

export const REPORT_REASONS = Constants.public.Enums.report_reason;
export const DOMAIN_CATEGORIES = [
  "shortener",
  "adult",
  "gambling",
  "piracy",
  "scam",
  "malware",
  "spam",
  "other",
] as const;

/** Reasons that hide content at the lower threshold; "severe" hides it at once. */
export const URGENT_REPORT_REASONS: readonly string[] = ["illegal", "scam_phishing"];
/** What a user can report with the report button (broken links have their own button). */
export const REPORTABLE_TARGETS = ["resource", "comment", "user"] as const;
export const REPORT_DETAILS_MAX = 500;

export const reportSchema = z.strictObject({
  targetType: z.enum(REPORTABLE_TARGETS),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS, message("reportReasonRequired")),
  details: z
    .string()
    .trim()
    .max(REPORT_DETAILS_MAX, message("reportDetailsTooLong"))
    .transform((value) => (value === "" ? null : value)),
});

export type ReportInput = z.input<typeof reportSchema>;
export type ReportData = z.output<typeof reportSchema>;

/** "Havola ishlamayapti": no reason, no note; the database allows one open report per user and resource. */
export const brokenLinkReportSchema = z.strictObject({ resourceId: z.uuid() });

export type BrokenLinkReportData = z.output<typeof brokenLinkReportSchema>;

export const REMOVAL_DETAILS_MIN = 20;
export const REMOVAL_DETAILS_MAX = 2000;

/** The public /removal-request form (no account needed). */
export const removalRequestSchema = z.strictObject({
  resourceUrl: z
    .string()
    .trim()
    .max(2048, message("removalUrlInvalid"))
    .pipe(z.url({ protocol: /^https?$/, error: "removalUrlInvalid" })),
  requesterName: z.string().trim().min(2, message("removalNameLength")).max(100, message("removalNameLength")),
  requesterEmail: z
    .string()
    .trim()
    .max(254, message("emailInvalid"))
    .pipe(z.email(message("emailInvalid"))),
  details: z
    .string()
    .trim()
    .min(REMOVAL_DETAILS_MIN, message("removalDetailsTooShort"))
    .max(REMOVAL_DETAILS_MAX, message("removalDetailsTooLong")),
  confirm: z.literal(true, message("removalConfirmRequired")),
  /** Honeypot: hidden from people, filled in by naive bots. */
  website: z.string().max(0).optional(),
});

export type RemovalRequestInput = z.input<typeof removalRequestSchema>;
export type RemovalRequestData = z.output<typeof removalRequestSchema>;

/** Same rules as the database's topic constraints. */
export const topicSchema = z.strictObject({
  slug: z
    .string()
    .trim()
    .max(60, message("topicSlugFormat"))
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, message("topicSlugFormat")),
  nameUz: z.string().trim().min(2, message("topicNameLength")).max(60, message("topicNameLength")),
  descriptionUz: z
    .string()
    .trim()
    .max(300, message("topicDescriptionTooLong"))
    .transform((value) => (value === "" ? null : value)),
  sortOrder: z
    .number(message("required"))
    .int(message("required"))
    .min(0, message("required"))
    .max(10000, message("required")),
});

export type TopicInput = z.input<typeof topicSchema>;
export type TopicData = z.output<typeof topicSchema>;

/** A domain for the blocklist: "bit.ly", "spam.example.com" (subdomains are blocked too). */
export const blockedDomainSchema = z.strictObject({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) =>
      value
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, ""),
    )
    .pipe(
      z
        .string()
        .max(253, message("domainFormat"))
        .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, message("domainFormat")),
    ),
  reason: z
    .string()
    .trim()
    .max(200, message("domainReasonTooLong"))
    .transform((value) => (value === "" ? null : value)),
  category: z.enum(DOMAIN_CATEGORIES, message("required")),
});

export type BlockedDomainInput = z.input<typeof blockedDomainSchema>;
export type BlockedDomainData = z.output<typeof blockedDomainSchema>;

/**
 * Rules of /qoidalar a moderator can point to (each has an anchor there). Report reasons are rules
 * too, so automatic hiding names the reason most reports gave.
 */
export const MODERATION_RULES = [
  "spam",
  "scam_phishing",
  "pirated",
  "illegal",
  "harassment",
  "inappropriate",
  "personal_data",
  "wrong_info",
  "copyright",
  "unsafe_link",
  "severe",
  "other",
] as const;

export type ModerationRule = (typeof MODERATION_RULES)[number];

export const MODERATION_REASON_MAX = 500;

/** What every moderation action carries: a reason (shown to the person concerned) and maybe a rule. */
export const moderationSchema = z.strictObject({
  reason: z
    .string()
    .transform((value) => cleanText(value, { multiline: true }))
    .pipe(
      z
        .string()
        .min(3, message("moderationReasonRequired"))
        .max(MODERATION_REASON_MAX, message("moderationReasonTooLong")),
    ),
  rule: z.enum(MODERATION_RULES).nullable().optional(),
});

export type ModerationInput = z.input<typeof moderationSchema>;
export type ModerationData = z.output<typeof moderationSchema>;

/** Temporary bans in days; permanent bans are for admins (or an admin's confirmation). */
export const BAN_LENGTHS = ["1", "7", "30", "permanent"] as const;

export const APPEAL_MIN = 10;
export const APPEAL_MAX = 1000;

/** One appeal per hidden resource or comment, or per ban. */
export const appealSchema = z.strictObject({
  targetType: z.enum(["resource", "comment", "ban"]),
  targetId: z.uuid(),
  message: z
    .string()
    .transform((value) => cleanText(value, { multiline: true }))
    .pipe(z.string().min(APPEAL_MIN, message("appealTooShort")).max(APPEAL_MAX, message("appealTooLong"))),
});

export type AppealInput = z.input<typeof appealSchema>;
export type AppealData = z.output<typeof appealSchema>;

export const TERM_CATEGORIES = ["profanity", "hate", "sexual", "drugs_weapons", "scam", "gambling"] as const;

/** An entry for the word filter, in the syntax of its lists: "word", "stem*" or "two words". */
export const blockedTermSchema = z.strictObject({
  term: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z
        .string()
        .min(2, message("termFormat"))
        .max(80, message("termFormat"))
        .regex(/^[\p{L}\p{N}ʻʼ'’-]+\*?( [\p{L}\p{N}ʻʼ'’-]+\*?)*$/u, message("termFormat")),
    ),
  category: z.enum(TERM_CATEGORIES, message("required")),
});

export type BlockedTermInput = z.input<typeof blockedTermSchema>;
export type BlockedTermData = z.output<typeof blockedTermSchema>;

export const INTERSTITIAL_MODES = ["off", "new_domains", "unknown"] as const;

export const settingsSchema = z.strictObject({
  report_hide_threshold: z
    .number(message("settingRange"))
    .min(0.5, message("settingRange"))
    .max(20, message("settingRange")),
  report_hide_threshold_urgent: z
    .number(message("settingRange"))
    .min(0.5, message("settingRange"))
    .max(20, message("settingRange")),
  interstitial_mode: z.enum(INTERSTITIAL_MODES, message("required")),
});

export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsData = z.output<typeof settingsSchema>;

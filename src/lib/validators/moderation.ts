import { z } from "zod";

import { Constants } from "@/types/database";

import { message } from "./messages";

export const REPORT_REASONS = Constants.public.Enums.report_reason;
/** What a user can report with the report button (broken links have their own button). */
export const REPORTABLE_TARGETS = ["resource", "comment", "user"] as const;
export const REPORT_DETAILS_MAX = 500;

export const reportSchema = z.object({
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
export const brokenLinkReportSchema = z.object({ resourceId: z.uuid() });

export type BrokenLinkReportData = z.output<typeof brokenLinkReportSchema>;

export const REMOVAL_DETAILS_MIN = 20;
export const REMOVAL_DETAILS_MAX = 2000;

/** The public /removal-request form (no account needed). */
export const removalRequestSchema = z.object({
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
export const topicSchema = z.object({
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
export const blockedDomainSchema = z.object({
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
});

export type BlockedDomainInput = z.input<typeof blockedDomainSchema>;
export type BlockedDomainData = z.output<typeof blockedDomainSchema>;

import { z } from "@/lib/zod";

import { cleanText } from "@/lib/clean-text";

import { message } from "./messages";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_MAX_LENGTH = 60;
export const BIO_MAX_LENGTH = 300;
export const UNIVERSITY_MAX_LENGTH = 120;
export const FIELD_OF_STUDY_MAX_LENGTH = 120;

/**
 * Names that would look official or collide with app words. The database enforces the format;
 * this list is product policy, so it lives here.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "api",
  "auth",
  "davra",
  "davracha",
  "help",
  "info",
  "kirish",
  "mod",
  "moderator",
  "null",
  "official",
  "root",
  "security",
  "sozlamalar",
  "staff",
  "support",
  "system",
  "undefined",
  "yordam",
]);

/** Same rule as the `profiles_username_format` constraint, after trimming and lower-casing. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9_]{3,30}$/, message("usernameFormat"))
      .refine((value) => !RESERVED_USERNAMES.has(value), message("usernameReserved")),
  );

export const displayNameSchema = z
  .string()
  .transform((value) => cleanText(value))
  .pipe(z.string().min(1, message("displayNameRequired")).max(DISPLAY_NAME_MAX_LENGTH, message("displayNameTooLong")));

/** Optional free text: cleaned (cleanText), and stored as null when empty. */
function optionalText(max: number, tooLong: Parameters<typeof message>[0], multiline = false) {
  return z
    .string()
    .transform((value) => cleanText(value, { multiline }))
    .pipe(z.string().max(max, message(tooLong)))
    .transform((value) => (value === "" ? null : value));
}

export const profileSchema = z.strictObject({
  displayName: displayNameSchema,
  username: usernameSchema,
  bio: optionalText(BIO_MAX_LENGTH, "bioTooLong", true),
  university: optionalText(UNIVERSITY_MAX_LENGTH, "universityTooLong"),
  fieldOfStudy: optionalText(FIELD_OF_STUDY_MAX_LENGTH, "fieldOfStudyTooLong"),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileData = z.output<typeof profileSchema>;

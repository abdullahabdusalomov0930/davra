import { z } from "@/lib/zod";

import { message } from "./messages";
import { containsPersonalInfo, isCommonPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password";
import { displayNameSchema, usernameSchema } from "./profile";

export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email(message("emailInvalid")).max(254, message("emailInvalid")));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, message("passwordTooShort"))
  .max(PASSWORD_MAX_LENGTH, message("passwordTooLong"))
  .refine((value) => !isCommonPassword(value), message("passwordCommon"));

export const signInSchema = z.strictObject({
  email: emailSchema,
  // No length rules on sign-in: an existing password is whatever it was when it was set.
  password: z.string().min(1, message("required")),
});

export const signUpSchema = z
  .strictObject({
    displayName: displayNameSchema,
    username: usernameSchema,
    email: emailSchema,
    password: newPasswordSchema,
  })
  .refine((data) => !containsPersonalInfo(data.password, data), { ...message("passwordPersonal"), path: ["password"] });

export const resetRequestSchema = z.strictObject({ email: emailSchema });

export const newPasswordFormSchema = z.strictObject({ password: newPasswordSchema });

export type SignInInput = z.input<typeof signInSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type ResetRequestInput = z.input<typeof resetRequestSchema>;
export type NewPasswordInput = z.input<typeof newPasswordFormSchema>;

/** A token or code from a Supabase e-mail, as parseConfirmationLink/parseRecoveryLink read it. */
const linkToken = z.string().regex(/^[A-Za-z0-9_-]{8,256}$/);

export const confirmationLinkSchema = z
  .union([
    z.strictObject({ tokenHash: linkToken, type: z.enum(["email", "signup"]) }),
    z.strictObject({ code: linkToken }),
  ])
  .nullable();

export const recoveryLinkSchema = z
  .union([z.strictObject({ tokenHash: linkToken }), z.strictObject({ code: linkToken })])
  .nullable();

/** Deleting an account: the username typed again and the current password. */
export const deleteAccountSchema = z.strictObject({
  username: z.string().trim().toLowerCase().min(1, message("required")).max(30, message("required")),
  password: z.string().min(1, message("required")).max(PASSWORD_MAX_LENGTH, message("required")),
});

export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;

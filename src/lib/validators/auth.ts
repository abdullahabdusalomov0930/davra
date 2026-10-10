import { z } from "@/lib/zod";

import { message } from "./messages";
import { displayNameSchema, usernameSchema } from "./profile";

/** Supabase hashes passwords with bcrypt, which ignores everything after 72 bytes. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email(message("emailInvalid")).max(254, message("emailInvalid")));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, message("passwordTooShort"))
  .max(PASSWORD_MAX_LENGTH, message("passwordTooLong"));

export const signInSchema = z.object({
  email: emailSchema,
  // No length rules on sign-in: an existing password is whatever it was when it was set.
  password: z.string().min(1, message("required")),
});

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordFormSchema = z.object({ password: newPasswordSchema });

export type SignInInput = z.input<typeof signInSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type ResetRequestInput = z.input<typeof resetRequestSchema>;
export type NewPasswordInput = z.input<typeof newPasswordFormSchema>;

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type AuthErrorKey, authErrorKey } from "@/lib/auth-errors";
import type { ConfirmationLink, RecoveryLink } from "@/lib/auth-links";
import { absoluteUrl } from "@/lib/seo";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import {
  confirmationLinkSchema,
  emailSchema,
  type NewPasswordInput,
  newPasswordFormSchema,
  recoveryLinkSchema,
  type ResetRequestInput,
  resetRequestSchema,
  type SignInInput,
  signInSchema,
  type SignUpInput,
  signUpSchema,
  type ValidationKey,
} from "@/lib/validators";
import { recordAuthEvent } from "@/server/auth/events";
import { verifyTurnstile } from "@/server/auth/turnstile";
import { checkRateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { checkText, TEXT_RULES } from "@/server/safety/text-policy";
import { createAdminClient } from "@/server/supabase/admin";

import { toFieldErrors } from "./validation";

/**
 * Authentication runs on the server (security addendum 5.1, DECISIONS.md D74): every attempt is rate
 * limited per IP and per e-mail address and logged for spotting attacks, sign-up names pass the text
 * policy, and the session cookies are HttpOnly (the browser never talks to Supabase Auth). Answers
 * never reveal whether an address has an account.
 */

export type AuthResult<Field extends string = never> =
  { ok: true } | { ok: false; error?: AuthErrorKey; fieldErrors?: Partial<Record<Field, ValidationKey>> };

export async function signInAction(input: SignInInput): Promise<AuthResult<keyof SignInInput>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors<keyof SignInInput>(parsed.error) };
  const { email, password } = parsed.data;
  const ip = await clientIp();

  if (!(await checkRateLimit("signIn", { ip, email }))) {
    await recordAuthEvent("rate_limited", { email, ip });
    return { ok: false, error: "rateLimited" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await recordAuthEvent("sign_in_failed", { email, ip });
    return { ok: false, error: authErrorKey(error) };
  }
  await recordAuthEvent("sign_in", { email, ip, userId: data.user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signUpAction(
  input: SignUpInput,
  captchaToken: string | null,
): Promise<AuthResult<keyof SignUpInput>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors<keyof SignUpInput>(parsed.error) };
  const { displayName, username, email, password } = parsed.data;
  const ip = await clientIp();

  if (!(await checkRateLimit("signUp", { ip }))) {
    await recordAuthEvent("rate_limited", { email, ip });
    return { ok: false, error: "rateLimited" };
  }
  if (!(await verifyTurnstile(captchaToken, ip))) {
    await recordAuthEvent("captcha_failed", { email, ip });
    return { ok: false, error: "captchaFailed" };
  }

  // Names are public: the same text policy as profiles (the account is created by Supabase Auth,
  // so the database's safety ticket does not apply to these two fields).
  const fieldErrors: Partial<Record<keyof SignUpInput, ValidationKey>> = {};
  for (const [field, value] of [
    ["displayName", displayName],
    ["username", username],
  ] as const) {
    const check = checkText(value, TEXT_RULES.line, { field });
    if (check.decision !== "allow") fieldErrors[field] = check.message ?? "textNotAllowed";
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // Friendly early check; the database stays the authority (it adds a suffix on a race).
  const { data: taken, error: takenError } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (takenError) return { ok: false, error: "unknown" };
  if (taken) return { ok: false, fieldErrors: { username: "usernameTaken" } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: absoluteUrl(routes.confirmEmail),
      data: { username, display_name: displayName },
    },
  });
  if (error) return { ok: false, error: authErrorKey(error) };
  // Supabase answers the same way for new and already registered addresses, so the form's message
  // never reveals whether an account exists.
  await recordAuthEvent("sign_up", { email, ip });
  return { ok: true };
}

export async function resendConfirmationAction(email: string): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: "unknown" };
  const ip = await clientIp();
  if (!(await checkRateLimit("resendConfirmation", { ip, email: parsed.data }))) {
    return { ok: false, error: "emailRateLimited" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: absoluteUrl(routes.confirmEmail) },
  });
  return error ? { ok: false, error: authErrorKey(error) } : { ok: true };
}

export async function requestPasswordResetAction(
  input: ResetRequestInput,
): Promise<AuthResult<keyof ResetRequestInput>> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors<keyof ResetRequestInput>(parsed.error) };
  const { email } = parsed.data;
  const ip = await clientIp();

  if (!(await checkRateLimit("passwordReset", { ip, email }))) {
    await recordAuthEvent("rate_limited", { email, ip });
    return { ok: false, error: "emailRateLimited" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: absoluteUrl(routes.newPassword) });
  // Same answer whether or not the address has an account; only limits are reported.
  if (error && authErrorKey(error) !== "unknown") return { ok: false, error: authErrorKey(error) };
  await recordAuthEvent("password_reset_requested", { email, ip });
  return { ok: true };
}

/** Confirms the address when the person presses the button (mail scanners only open the link). */
export async function confirmEmailAction(input: ConfirmationLink): Promise<AuthResult> {
  const parsed = confirmationLinkSchema.safeParse(input);
  const link = parsed.success ? parsed.data : null;
  if (!link) return { ok: false, error: "linkInvalid" };
  const supabase = await createClient();
  const { error } =
    "code" in link
      ? await supabase.auth.exchangeCodeForSession(link.code)
      : await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
  if (error) return { ok: false, error: "linkInvalid" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Sets a new password from a recovery link. The token is used only on submit; after it was used
 * once the session exists, so a second attempt (e.g. after "password too common") only updates the
 * password.
 */
export async function updatePasswordAction(
  linkInput: RecoveryLink,
  input: NewPasswordInput,
): Promise<AuthResult<keyof NewPasswordInput>> {
  const parsedLink = recoveryLinkSchema.safeParse(linkInput);
  const link = parsedLink.success ? parsedLink.data : null;
  const parsed = newPasswordFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors<keyof NewPasswordInput>(parsed.error) };

  const supabase = await createClient();
  const { data: current } = await supabase.auth.getUser();
  if (!current.user) {
    if (!link) return { ok: false, error: "linkInvalid" };
    const { error } =
      "code" in link
        ? await supabase.auth.exchangeCodeForSession(link.code)
        : await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: "recovery" });
    if (error) return { ok: false, error: "linkInvalid" };
  }

  const { data, error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorKey(error) };
  await recordAuthEvent("password_changed", { userId: data.user.id, ip: await clientIp() });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Signing out runs here so the session cookies are cleared on the response that renders the next page. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

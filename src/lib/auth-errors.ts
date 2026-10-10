import type messages from "../../messages/uz.json";

export type AuthErrorKey = keyof (typeof messages)["AuthErrors"];

type AuthErrorLike = { code?: string | null; status?: number | null; name?: string | null };

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "emailRateLimited",
  weak_password: "weakPassword",
  same_password: "samePassword",
  otp_expired: "linkInvalid",
  flow_state_expired: "linkInvalid",
  flow_state_not_found: "linkInvalid",
  bad_code_verifier: "linkInvalid",
  signup_disabled: "signupDisabled",
  email_provider_disabled: "signupDisabled",
};

/** Maps a Supabase Auth error to a translated message key. Unknown errors get a generic message. */
export function authErrorKey(error: AuthErrorLike | null | undefined): AuthErrorKey {
  if (!error) return "unknown";
  if (error.code && error.code in BY_CODE) return BY_CODE[error.code];
  if (error.status === 429) return "rateLimited";
  // supabase-js reports fetch failures as AuthRetryableFetchError without a code.
  if (error.name === "AuthRetryableFetchError") return "network";
  return "unknown";
}

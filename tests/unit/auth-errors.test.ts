import { describe, expect, it } from "vitest";

import { authErrorKey } from "@/lib/auth-errors";

describe("authErrorKey", () => {
  it("maps known Supabase Auth error codes", () => {
    expect(authErrorKey({ code: "invalid_credentials", status: 400 })).toBe("invalidCredentials");
    expect(authErrorKey({ code: "email_not_confirmed", status: 400 })).toBe("emailNotConfirmed");
    expect(authErrorKey({ code: "otp_expired", status: 403 })).toBe("linkInvalid");
    expect(authErrorKey({ code: "over_email_send_rate_limit", status: 429 })).toBe("emailRateLimited");
  });

  it("treats any 429 as rate limiting", () => {
    expect(authErrorKey({ code: "something_new", status: 429 })).toBe("rateLimited");
  });

  it("recognizes network failures and falls back to a generic message", () => {
    expect(authErrorKey({ name: "AuthRetryableFetchError", status: 0 })).toBe("network");
    expect(authErrorKey({ code: "unexpected_failure", status: 500 })).toBe("unknown");
    expect(authErrorKey(null)).toBe("unknown");
  });
});

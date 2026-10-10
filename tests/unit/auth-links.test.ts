import { describe, expect, it } from "vitest";

import { parseConfirmationLink, parseRecoveryLink } from "@/lib/auth-links";

const hash = "pkce_0f1e2d3c4b5a69788796a5b4c3d2e1f0";

describe("parseConfirmationLink", () => {
  it("reads token_hash links from our email template", () => {
    expect(parseConfirmationLink({ token_hash: hash, type: "email" })).toEqual({ tokenHash: hash, type: "email" });
  });

  it("falls back to a PKCE code", () => {
    expect(parseConfirmationLink({ code: "8f1c2a8e-4c33-4c1a-9f0e-1f2b3c4d5e6f" })).toEqual({
      code: "8f1c2a8e-4c33-4c1a-9f0e-1f2b3c4d5e6f",
    });
  });

  it("ignores other link types and malformed tokens", () => {
    expect(parseConfirmationLink({ token_hash: hash, type: "recovery" })).toBeNull();
    expect(parseConfirmationLink({ token_hash: "<script>", type: "email" })).toBeNull();
    expect(parseConfirmationLink({})).toBeNull();
  });
});

describe("parseRecoveryLink", () => {
  it("accepts only recovery links", () => {
    expect(parseRecoveryLink({ token_hash: hash, type: "recovery" })).toEqual({ tokenHash: hash });
    expect(parseRecoveryLink({ token_hash: hash, type: "email" })).toBeNull();
  });

  it("uses the first value of repeated parameters", () => {
    expect(parseRecoveryLink({ token_hash: [hash, "x"], type: ["recovery"] })).toEqual({ tokenHash: hash });
  });
});

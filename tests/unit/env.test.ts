import { describe, expect, it } from "vitest";

import { publicEnvSchema } from "@/lib/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("publicEnvSchema", () => {
  it("defaults the site URL for local development", () => {
    expect(publicEnvSchema.parse(valid).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("rejects a missing publishable key", () => {
    expect(publicEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }).success).toBe(false);
  });

  it("rejects an invalid Supabase URL", () => {
    expect(publicEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url" }).success).toBe(false);
  });

  it("rejects a Supabase URL without https:// (a common copy-paste mistake)", () => {
    expect(publicEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "abcdefgh.supabase.co" }).success).toBe(
      false,
    );
  });

  it("accepts only http(s) URLs", () => {
    expect(publicEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SITE_URL: "ftp://davra.uz" }).success).toBe(false);
  });

  it("trims values pasted with surrounding spaces", () => {
    const env = publicEnvSchema.parse({
      ...valid,
      NEXT_PUBLIC_SUPABASE_URL: " https://abcdefgh.supabase.co ",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_test\n",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://abcdefgh.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_test");
  });

  it("accepts an optional contact email and rejects a malformed one", () => {
    expect(publicEnvSchema.parse(valid).NEXT_PUBLIC_CONTACT_EMAIL).toBeUndefined();
    expect(
      publicEnvSchema.parse({ ...valid, NEXT_PUBLIC_CONTACT_EMAIL: " info@davra.uz " }).NEXT_PUBLIC_CONTACT_EMAIL,
    ).toBe("info@davra.uz");
    expect(publicEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_CONTACT_EMAIL: "davra.uz" }).success).toBe(false);
  });
});

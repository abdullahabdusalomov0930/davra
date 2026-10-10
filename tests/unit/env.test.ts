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
});

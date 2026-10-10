import { describe, expect, it } from "vitest";

import { checkRateLimit, hashKey, MemoryRateLimitStore, RATE_LIMITS, setRateLimitStore } from "@/server/rate-limit";

const SECRET = "test-secret";

describe("MemoryRateLimitStore", () => {
  it("allows `max` hits per sliding window", async () => {
    let now = 0;
    const store = new MemoryRateLimitStore(() => now);
    for (let i = 0; i < 3; i++) expect(await store.hit("b", "k", 3, 60)).toBe(true);
    expect(await store.hit("b", "k", 3, 60)).toBe(false);
    now = 30_000;
    expect(await store.hit("b", "k", 3, 60)).toBe(false);
    // The first hits leave the window one minute after they were made.
    now = 60_001;
    expect(await store.hit("b", "k", 3, 60)).toBe(true);
    expect(await store.hit("b", "other", 3, 60)).toBe(true);
  });
});

describe("checkRateLimit", () => {
  it("counts every key and refuses when any of them is over its limit", async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    const { email } = RATE_LIMITS.signIn;
    for (let i = 0; i < email.max; i++) {
      expect(await checkRateLimit("signIn", { ip: `10.0.0.${i}`, email: "a@b.uz" }, SECRET)).toBe(true);
    }
    expect(await checkRateLimit("signIn", { ip: "10.0.1.1", email: "A@B.uz " }, SECRET)).toBe(false);
    expect(await checkRateLimit("signIn", { ip: "10.0.1.1", email: "c@d.uz" }, SECRET)).toBe(true);
  });

  it("limits searches to 60 a minute per address", async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    const results = [];
    for (let i = 0; i < 61; i++) results.push(await checkRateLimit("search", { ip: "192.0.2.1" }, SECRET));
    expect(results.filter(Boolean)).toHaveLength(60);
  });
});

describe("hashKey", () => {
  it("never keeps the address and ignores case and spaces", () => {
    const hash = hashKey("email", " Nodira@Example.com", SECRET);
    expect(hash).not.toContain("nodira");
    expect(hash).toBe(hashKey("email", "nodira@example.com", SECRET));
    expect(hash).not.toBe(hashKey("ip", "nodira@example.com", SECRET));
  });
});

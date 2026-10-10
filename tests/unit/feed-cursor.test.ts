import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/lib/feed-cursor";

const keyset = {
  p: "2026-10-10T12:00:00.123456+00:00",
  i: "6b1b5c2e-8a4f-4d6e-9c8b-2f6e1a0d3c7b",
  r: "3.6666666666666665",
  c: 1,
};

describe("feed cursor", () => {
  it("round-trips the database's cursor exactly", () => {
    expect(decodeCursor(encodeCursor(keyset))).toEqual(keyset);
    expect(decodeCursor(encodeCursor({ o: 18 }))).toEqual({ o: 18 });
    expect(decodeCursor(encodeCursor({ ...keyset, s: "1.2e-05" }))).toMatchObject({ s: "1.2e-05" });
  });

  it("rejects anything else", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(decodeCursor(encodeCursor({}))).toBeNull();
    expect(decodeCursor(encodeCursor({ ...keyset, extra: 1 }))).toBeNull();
    expect(decodeCursor(encodeCursor({ ...keyset, r: "1; drop table" }))).toBeNull();
    expect(decodeCursor(encodeCursor({ ...keyset, i: "x" }))).toBeNull();
    expect(decodeCursor(encodeCursor({ o: 5000 }))).toBeNull();
    expect(decodeCursor("a".repeat(301))).toBeNull();
  });
});

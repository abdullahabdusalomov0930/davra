import { describe, expect, it } from "vitest";

import { contentHash, ticketParts } from "@/server/safety/tickets";

describe("contentHash", () => {
  it("matches private.content_hash() in the database", () => {
    // select private.content_hash('https://example.org/kurs', 'Oʻzbek tili', 'Tavsif', 'Hamma uchun', '')
    expect(contentHash(["https://example.org/kurs", "Oʻzbek tili", "Tavsif", "Hamma uchun", null])).toBe(
      "1bc69146a1a662d1278eca3c3982e70bfc97f17503cd894e39ad93c31f63ac07",
    );
  });

  it("keeps fields apart", () => {
    expect(contentHash(["ab", "c"])).not.toBe(contentHash(["a", "bc"]));
  });
});

describe("ticketParts", () => {
  it("lists the fields in the order the triggers hash them", () => {
    expect(
      ticketParts({
        kind: "profile",
        displayName: "Ali",
        username: "ali",
        bio: null,
        university: "TATU",
        fieldOfStudy: null,
      }),
    ).toEqual(["ali", "Ali", null, "TATU", null]);
  });

  it("writes resource ids in lower case, as uuid::text does", () => {
    expect(
      ticketParts({ kind: "comment", resourceId: "0000000A-0000-4000-8000-00000000C001", body: "Rahmat" }),
    ).toEqual(["0000000a-0000-4000-8000-00000000c001", "Rahmat"]);
  });
});

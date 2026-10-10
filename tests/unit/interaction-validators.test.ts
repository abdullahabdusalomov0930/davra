import { describe, expect, it } from "vitest";

import { commentSchema, ratingSchema } from "@/lib/validators";

const errorOf = (schema: typeof ratingSchema | typeof commentSchema, input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? undefined : result.error.issues.map((issue) => issue.message);
};

describe("ratingSchema", () => {
  it("accepts 1–5 stars and stores an empty review as null", () => {
    expect(ratingSchema.parse({ stars: 4, reviewText: "  " })).toEqual({ stars: 4, reviewText: null });
    expect(ratingSchema.parse({ stars: 5, reviewText: " Juda foydali. " }).reviewText).toBe("Juda foydali.");
  });

  it("asks for a star when none or an invalid one is chosen", () => {
    expect(errorOf(ratingSchema, { stars: 0, reviewText: "" })).toEqual(["ratingRequired"]);
    expect(errorOf(ratingSchema, { stars: 6, reviewText: "" })).toEqual(["ratingRequired"]);
    expect(errorOf(ratingSchema, { stars: 2.5, reviewText: "" })).toBeDefined();
    expect(errorOf(ratingSchema, { stars: "5", reviewText: "" })).toEqual(["ratingRequired"]);
  });

  it("limits the review to 500 characters", () => {
    expect(errorOf(ratingSchema, { stars: 3, reviewText: "ab".repeat(251) })).toEqual(["reviewTooLong"]);
  });
});

describe("commentSchema", () => {
  it("trims and requires text", () => {
    expect(commentSchema.parse({ body: "  Rahmat!  " })).toEqual({ body: "Rahmat!" });
    expect(errorOf(commentSchema, { body: "   " })).toEqual(["commentRequired"]);
    expect(errorOf(commentSchema, { body: "ab".repeat(251) })).toEqual(["commentTooLong"]);
  });
});

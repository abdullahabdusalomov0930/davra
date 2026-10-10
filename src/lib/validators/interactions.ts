import { z } from "@/lib/zod";

import { cleanText } from "@/lib/clean-text";

import { message } from "./messages";

const cleaned = () => z.string().transform((value) => cleanText(value, { multiline: true }));

export const REVIEW_MAX = 500;
export const COMMENT_MAX = 500;

/** A rating of 1–5 stars with an optional short review (the database allows 500 characters). */
export const ratingSchema = z.object({
  stars: z.number(message("ratingRequired")).int().min(1, message("ratingRequired")).max(5, message("ratingRequired")),
  reviewText: cleaned()
    .pipe(z.string().max(REVIEW_MAX, message("reviewTooLong")))
    .transform((value) => (value === "" ? null : value)),
});

export type RatingInput = z.input<typeof ratingSchema>;
export type RatingData = z.output<typeof ratingSchema>;

/** A flat comment; comments cannot be edited, only deleted. */
export const commentSchema = z.object({
  body: cleaned().pipe(z.string().min(1, message("commentRequired")).max(COMMENT_MAX, message("commentTooLong"))),
});

export type CommentInput = z.input<typeof commentSchema>;
export type CommentData = z.output<typeof commentSchema>;

import { z } from "zod";

/**
 * Where the next page of a resource list starts. The database builds it for every row
 * (`search_resources.next_cursor`); the app only carries it through URLs and "load more" requests
 * as an opaque base64url string, and checks its shape before handing it back.
 */
const cursorSchema = z
  .object({
    p: z.iso.datetime({ offset: true }),
    i: z.uuid(),
    s: z.string().regex(/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i),
    r: z.string().regex(/^\d+(\.\d+)?(e[+-]?\d+)?$/i),
    c: z.number().int().min(0),
    o: z.number().int().min(0).max(1000),
  })
  .partial()
  .strict()
  .refine((cursor) => Object.keys(cursor).length > 0);

export type FeedCursor = z.infer<typeof cursorSchema>;

const MAX_CURSOR_LENGTH = 300;

export function encodeCursor(cursor: unknown): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

/** The cursor, or null for anything that is not one of ours (the list then starts at the top). */
export function decodeCursor(value: string | undefined | null): FeedCursor | null {
  if (!value || value.length > MAX_CURSOR_LENGTH) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

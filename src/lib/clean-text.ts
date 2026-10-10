/**
 * Tidies a user's text before it is validated, checked and stored (security addendum 2.1). Used by
 * the Zod schemas, so forms and server clean the same way. Safe to apply twice.
 */

// Superscripts, subscripts and fractions mean something in maths and chemistry (x², H₂O, ½): NFKC
// would turn them into plain digits.
const KEEP_AS_WRITTEN = /[\u00B2\u00B3\u00B9\u00BC-\u00BE\u2070-\u209F\u2150-\u218B]/u;
const NORMALIZE_RUNS = /[^\u00B2\u00B3\u00B9\u00BC-\u00BE\u2070-\u209F\u2150-\u218B]+/gu;

// Invisible format characters (zero-width spaces, direction overrides, soft hyphens, BOM). The
// zero-width joiner survives between emoji, where it builds one picture (👩‍💻).
const INVISIBLE = /(?!(?<=\p{Extended_Pictographic}\uFE0F?)\u200D(?=\p{Extended_Pictographic}))\p{Cf}/gu;
// Control characters other than line breaks.
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;
// The same letter, punctuation mark or emoji more than three times ("zooooor", "!!!!!"); digits are
// left alone (10000).
const REPEATED = /([\p{L}\p{P}\p{S}])\1{3,}/gu;

/**
 * NFKC (stylised letters such as "𝐁𝐄𝐏𝐔𝐋" become plain ones), no invisible or control characters,
 * single spaces, no more than three of the same character in a row, and line breaks only where a
 * text may have paragraphs (at most one empty line between them).
 */
export function cleanText(value: string, { multiline = false }: { multiline?: boolean } = {}): string {
  const normalized = (
    KEEP_AS_WRITTEN.test(value)
      ? value.replace(NORMALIZE_RUNS, (run) => run.normalize("NFKC"))
      : value.normalize("NFKC")
  )
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
    .replace(REPEATED, "$1$1$1");

  const lines = normalized.split("\n").map((line) => line.replace(/\s+/gu, " ").trim());
  if (!multiline) return lines.filter(Boolean).join(" ");
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

import { toLatin } from "./transliterate";

/** Every apostrophe-like character used in Uzbek Latin (oʻ, gʻ, tutuq belgisi) and its look-alikes. */
const APOSTROPHES = /['‘’ʻʼ`´]/g;

export const SLUG_MAX_LENGTH = 80;

/** Same rule as the database's `resources_slug_format` check (which allows up to 100 characters). */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Cheap check before a database lookup, so junk URLs go straight to 404. */
export function isValidSlug(slug: string): boolean {
  return slug.length <= 100 && SLUG_PATTERN.test(slug);
}

/**
 * URL slug from a title: "Oʻzbek tili: grammatika" → "ozbek-tili-grammatika",
 * "Шахсий молия" → "shaxsiy-moliya". Apostrophes are dropped (oʻ → o, gʻ → g), so sh/ch/ng stay as
 * written. Falls back to "resurs" when nothing usable is left.
 */
export function slugify(title: string, fallback = "resurs"): string {
  const latin = toLatin(title).replace(APOSTROPHES, "").normalize("NFKD").replace(/[̀-ͯ]/g, "");

  let slug = latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length > SLUG_MAX_LENGTH) {
    const cut = slug.slice(0, SLUG_MAX_LENGTH);
    slug = cut.includes("-") ? cut.slice(0, cut.lastIndexOf("-")) : cut;
  }
  return slug || fallback;
}

/** Short random suffix for a slug that is already taken: "python-asoslari-k3x9". */
export function withSuffix(slug: string): string {
  const suffix = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
  return `${slug.slice(0, SLUG_MAX_LENGTH - 5).replace(/-+$/, "")}-${suffix}`;
}

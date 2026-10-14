import { getPublicEnv } from "@/lib/env";
import { APP_NAME } from "@/lib/config";

/** Search engines show about 160 characters of a description. */
const DESCRIPTION_MAX = 160;

/** Shortens text for a meta description, at a word boundary where possible. */
export function metaDescription(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  // The cut ends a word when a space follows it; otherwise drop the partial word.
  const end = clean[max - 1] === " " ? cut.length : cut.lastIndexOf(" ");
  return `${(end > max * 0.6 ? cut.slice(0, end) : cut).replace(/[\s.,;:—–-]+$/, "")}…`;
}

/** `/resurs/x` → `https://<site>/resurs/x`, for sitemaps and structured data. */
export function absoluteUrl(path: string): string {
  return new URL(path, getPublicEnv().NEXT_PUBLIC_SITE_URL).toString();
}

/**
 * OpenGraph fields every page shares. A page that sets its own `openGraph` replaces the layout's
 * object entirely, so it spreads these in.
 */
export const openGraphBase = { siteName: APP_NAME, locale: "uz_UZ" } as const;

/**
 * When a link opens the "Siz tashqi saytga oʻtyapsiz" page first (security addendum 4, D73): never
 * for links known to be safe; for links to domains Davracha had not seen before, shared by a member
 * below trust level 2 ("new_domains", the default), or for every link not known to be safe
 * ("unknown"); never when an admin turned it off.
 */
export type InterstitialMode = "off" | "new_domains" | "unknown";

export function needsInterstitial(
  link: { reputation_status: string; unvetted_domain: boolean },
  mode: InterstitialMode,
): boolean {
  if (mode === "off" || link.reputation_status === "safe") return false;
  return mode === "unknown" || link.unvetted_domain;
}

/** Every outbound link to a user's site: new tab, no referrer or opener, no ranking credit. */
export const OUTBOUND_REL = "noopener noreferrer nofollow ugc";

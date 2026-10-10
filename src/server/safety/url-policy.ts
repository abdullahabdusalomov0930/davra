import "server-only";

import { domainToUnicode } from "node:url";

import { normalizeUrl } from "@/lib/url-normalize";
import type { ValidationKey } from "@/lib/validators";

import blocklist from "./data/blocked-domains.json";
import shorteners from "./data/shorteners.json";
import type { Reputation, UrlReputationProvider } from "./reputation";
import { safeFetch, SafeFetchError } from "./safe-fetch";

/**
 * Which links may be shared (security addendum 2.1, DECISIONS.md D65). Two steps:
 *
 * 1. `checkUrl` — on the address alone: http(s) only, no credentials, no IP addresses or intranet
 *    hosts, standard ports, tracking parameters removed (normalizeUrl, shared with the form); no link
 *    shorteners; no lookalike domains mixing alphabets; the category blocklists.
 * 2. `inspectUrl` — where the link really leads: redirects are followed (safeFetch: at most 3, every
 *    hop checked against SSRF), the final address goes through step 1 again, and both addresses are
 *    looked up in the reputation service if one is configured.
 *
 * The admin-editable `blocked_domains` table is enforced by the database itself, on the link and on
 * where it leads.
 */

export type UrlDecision = "allow" | "needs_review" | "reject";

export type UrlCheck =
  | { decision: "allow" | "needs_review"; url: string; host: string; reasons: string[] }
  | { decision: "reject"; reasons: string[]; message: ValidationKey };

type Category = { action: "reject" | "review"; domains: string[] };

const SHORTENERS = shorteners.domains;
const CATEGORIES = Object.entries(blocklist.categories as Record<string, Category>);

function matchesDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

// Cyrillic and Greek letters that look like Latin ones.
const LATIN_LOOKALIKES = new Set([..."аеорсухіјѕһԁԛԝԍӏ", ..."οαρτνκχιυεβ"]);

// The alphabets whose letters can pass for each other.
function scriptOf(letter: string) {
  if (/\p{Script=Latin}/u.test(letter)) return "Latin";
  if (/\p{Script=Cyrillic}/u.test(letter)) return "Cyrillic";
  if (/\p{Script=Greek}/u.test(letter)) return "Greek";
  return null;
}

/**
 * A host that imitates another one: a label mixing Latin, Cyrillic or Greek letters ("pаypal" with
 * a Cyrillic "а"), or a label in Cyrillic or Greek made only of letters that look Latin ("аррӏе").
 * Real Cyrillic domains ("яндекс.рф") use letters that do not look Latin, so they pass.
 */
export function isLookalikeHost(host: string): boolean {
  return domainToUnicode(host)
    .split(".")
    .some((label) => {
      const letters = [...label].filter((char) => scriptOf(char) !== null);
      const scripts = new Set(letters.map(scriptOf));
      if (scripts.size > 1) return true;
      return scripts.size === 1 && !scripts.has("Latin") && letters.every((letter) => LATIN_LOOKALIKES.has(letter));
    });
}

export function checkUrl(raw: string): UrlCheck {
  const normalized = normalizeUrl(raw);
  if (!normalized.ok) return { decision: "reject", reasons: [`url.${normalized.error}`], message: normalized.error };

  const url = normalized.url;
  const host = new URL(url).hostname;
  const bare = host.replace(/^www\./, "");

  if (isLookalikeHost(host)) return { decision: "reject", reasons: ["url.lookalike"], message: "urlLookalike" };
  if (SHORTENERS.some((domain) => matchesDomain(bare, domain))) {
    return { decision: "reject", reasons: ["url.shortener"], message: "urlShortener" };
  }

  const reasons: string[] = [];
  for (const [name, category] of CATEGORIES) {
    if (!category.domains.some((domain) => matchesDomain(bare, domain))) continue;
    if (category.action === "reject") {
      return { decision: "reject", reasons: [`url.category:${name}`], message: "urlBlocked" };
    }
    reasons.push(`url.category:${name}`);
  }
  return { decision: reasons.length ? "needs_review" : "allow", url, host, reasons };
}

export type UrlInspection = {
  decision: UrlDecision;
  reasons: string[];
  message?: ValidationKey;
  /** Where the link leads after redirects; null when the site could not be reached. */
  finalUrl: string | null;
  reputation: Reputation;
};

/** Follows the link and checks where it really leads. `url` must have passed checkUrl. */
export async function inspectUrl(
  url: string,
  {
    userAgent,
    reputation,
    timeoutMs = 5_000,
  }: { userAgent: string; reputation: UrlReputationProvider; timeoutMs?: number },
): Promise<UrlInspection> {
  let finalUrl: string | null = null;
  try {
    finalUrl = (await safeFetch(url, { method: "HEAD", userAgent, timeoutMs })).url;
  } catch (error) {
    if (!(error instanceof SafeFetchError)) throw error;
    if (error.code === "too_many_redirects") {
      return { decision: "needs_review", reasons: ["url.redirect_chain"], finalUrl: null, reputation: "unknown" };
    }
    if (["blocked_address", "blocked_port", "blocked_scheme", "credentials"].includes(error.code)) {
      // The link, or a page it redirects to, points into a private network or at a non-web address.
      return {
        decision: "reject",
        reasons: [`url.redirect_${error.code}`],
        message: "urlNotPublic",
        finalUrl: null,
        reputation: "unknown",
      };
    }
    // The site did not answer (down, slow, refusing bots): nothing more to learn; the link checker
    // will look again later.
  }

  const reasons: string[] = [];
  let decision: UrlDecision = "allow";
  if (finalUrl && new URL(finalUrl).hostname !== new URL(url).hostname) {
    const final = checkUrl(finalUrl);
    if (final.decision === "reject") {
      return {
        decision: "reject",
        reasons: final.reasons.map((reason) => `final.${reason}`),
        message: final.message,
        finalUrl,
        reputation: "unknown",
      };
    }
    if (final.decision === "needs_review") {
      decision = "needs_review";
      reasons.push(...final.reasons.map((reason) => `final.${reason}`));
    }
  }

  const checked = await reputation.check(finalUrl && finalUrl !== url ? [url, finalUrl] : [url]);
  const verdicts = [...checked.values()];
  if (verdicts.includes("flagged")) {
    return { decision: "reject", reasons: ["url.reputation"], message: "urlUnsafe", finalUrl, reputation: "flagged" };
  }
  return {
    decision,
    reasons,
    finalUrl,
    reputation: verdicts.length > 0 && verdicts.every((verdict) => verdict === "safe") ? "safe" : "unknown",
  };
}

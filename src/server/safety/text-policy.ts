import "server-only";

import type { ValidationKey } from "@/lib/validators";

import { type WordCategory, type WordFilter, wordFilter } from "./word-filter";

/**
 * Text policy (security addendum 2.1, DECISIONS.md D66): what users may write in titles, summaries,
 * reviews, comments and profiles. Texts arrive cleaned by the Zod schemas (`cleanText`, which the
 * forms share); `checkText` decides whether they may be published. Formatting rules the forms also
 * show (length, ALL CAPS titles, emoji) stay in the schemas.
 */

export type TextDecision = "allow" | "needs_review" | "reject";

export type TextCheck = { decision: TextDecision; reasons: string[]; message?: ValidationKey };

export type TextRules = {
  /** Links allowed in the text. */
  maxLinks: number;
  /** Phone numbers and Telegram/WhatsApp invites: refused, or sent to a moderator. */
  contacts: "reject" | "review";
};

/** Rules per kind of field. */
export const TEXT_RULES = {
  /** Titles, "for whom", names, usernames, university, field of study. */
  line: { maxLinks: 0, contacts: "reject" },
  /** A resource's summary and the author's review, a rating's review, a profile's bio. */
  text: { maxLinks: 1, contacts: "reject" },
  comment: { maxLinks: 1, contacts: "review" },
} as const satisfies Record<string, TextRules>;

export type TextKind = keyof typeof TEXT_RULES;

/**
 * What each category of the word lists leads to. Gambling words go to a moderator because some of
 * them also have innocent uses; the owner may move a category.
 */
export const CATEGORY_DECISION: Record<WordCategory, Exclude<TextDecision, "allow">> = {
  profanity: "reject",
  hate: "reject",
  sexual: "reject",
  drugs_weapons: "reject",
  scam: "reject",
  gambling: "needs_review",
};

// Links: with a scheme, starting with "www.", or a domain with a common ending followed by a path
// ("site.uz/kurs"). "Node.js/Express" or a bare "Coursera.org" is not counted.
const TLDS = "uz|com|net|org|ru|io|me|info|co|dev|app|xyz|edu|gov|ly|to|tv|link|site|online|top|kz|tj|kg|su|by|ua";
const LINK = new RegExp(String.raw`\b(?:https?:\/\/|www\.)\S+|\b(?:[\p{L}\p{N}-]+\.)+(?:${TLDS})\/\S*`, "giu");
const INVITE = /\b(?:t\.me|telegram\.(?:me|dog)|wa\.me|chat\.whatsapp\.com|api\.whatsapp\.com)\/\S*/iu;
// "+998 90 123 45 67", "+7 (912) 345-67-89", and Uzbek numbers without the plus: "90 123 45 67".
// ISBNs and years do not have this shape.
const PHONE =
  /(?<![\p{L}\p{N}])(?:\+\d(?:[\s().-]?\d){8,14}|(?:998[\s-]?)?\(?(?:20|33|50|55|61|62|65|66|67|69|71|72|73|74|75|76|77|78|79|88|90|91|93|94|95|97|98|99)\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})(?![\p{L}\p{N}])/u;
// A text that is little more than a link.
const MIN_OWN_LETTERS = 10;

const SEVERITY: Record<TextDecision, number> = { allow: 0, needs_review: 1, reject: 2 };

export function worse(a: TextDecision, b: TextDecision): TextDecision {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

export function countLinks(text: string): number {
  return text.match(LINK)?.length ?? 0;
}

export type CheckTextOptions = { field: string; filter?: WordFilter };

/** Checks one cleaned text. Reasons are internal ("text.scam:summary"); the message is for the user. */
export function checkText(
  value: string,
  rules: TextRules,
  { field, filter = wordFilter }: CheckTextOptions,
): TextCheck {
  if (!value) return { decision: "allow", reasons: [] };

  const reasons: string[] = [];
  let decision: TextDecision = "allow";
  let message: ValidationKey | undefined;
  const flag = (next: Exclude<TextDecision, "allow">, reason: string, key: ValidationKey) => {
    reasons.push(`${reason}:${field}`);
    if (SEVERITY[next] > SEVERITY[decision] || !message) message = key;
    decision = worse(decision, next);
  };

  // Words first: of equally serious reasons, the first decides the message.
  for (const category of filter.find(value)) flag(CATEGORY_DECISION[category], `text.${category}`, "textNotAllowed");

  if (PHONE.test(value) || INVITE.test(value)) {
    flag(rules.contacts === "review" ? "needs_review" : "reject", "text.contact", "textContact");
  }

  const links = countLinks(value);
  if (links > rules.maxLinks) {
    flag("reject", "text.links", "textTooManyLinks");
  } else if (links > 0 && (value.replace(LINK, "").match(/\p{L}/gu)?.length ?? 0) < MIN_OWN_LETTERS) {
    flag("reject", "text.only_link", "textOnlyLink");
  }

  return decision === "allow" ? { decision, reasons } : { decision, reasons, message };
}

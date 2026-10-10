import "server-only";

import type { ValidationKey } from "@/lib/validators";

import type { Reputation } from "./reputation";
import { checkText, countLinks, TEXT_RULES, type TextDecision, type TextKind, worse } from "./text-policy";
import { checkUrl, type UrlInspection } from "./url-policy";
import { type WordFilter, wordsOf } from "./word-filter";

/**
 * The decision on one submission (security addendum 2.1, layer 1): the text policy on every field,
 * the URL policy on a resource's link, the author's trust level and near-duplicates, combined into
 * allow / needs_review / reject. Pure apart from `inspectUrl`, which the caller provides.
 */

export type Decision = TextDecision;

export type Submission =
  | {
      kind: "resource";
      url: string;
      title: string;
      summary: string;
      forWhom: string;
      authorReview: string | null;
    }
  | { kind: "comment"; resourceId: string; body: string }
  | { kind: "rating"; resourceId: string; reviewText: string | null }
  | {
      kind: "profile";
      displayName: string;
      username: string;
      bio: string | null;
      university: string | null;
      fieldOfStudy: string | null;
    };

export type EvaluationContext = {
  /** 0 new, 1 trusted author, 3 staff (my_trust_level). */
  trustLevel: number;
  /** For resources: the author's other cards from the last 24 hours. */
  recentResources?: readonly { title: string; summary: string }[];
  /** For resources: follows the link (url-policy inspectUrl). Left out, the link is not visited. */
  inspectUrl?: (url: string) => Promise<UrlInspection>;
  filter?: WordFilter;
};

export type Evaluation = {
  decision: Decision;
  /** Internal reason codes for moderation_events. */
  reasons: string[];
  /** For a rejection: what to tell the author, per form field. */
  fieldErrors: Record<string, ValidationKey>;
  finalUrl: string | null;
  reputation: Reputation;
};

/** Near-duplicates: this share of the same words in title and summary. */
export const DUPLICATE_SIMILARITY = 0.8;

type TextField = [field: string, value: string | null, kind: TextKind];

function textFields(submission: Submission): TextField[] {
  switch (submission.kind) {
    case "resource":
      return [
        ["title", submission.title, "line"],
        ["summary", submission.summary, "text"],
        ["forWhom", submission.forWhom, "line"],
        ["authorReview", submission.authorReview, "text"],
      ];
    case "comment":
      return [["body", submission.body, "comment"]];
    case "rating":
      return [["reviewText", submission.reviewText, "text"]];
    case "profile":
      return [
        ["displayName", submission.displayName, "line"],
        ["username", submission.username, "line"],
        ["bio", submission.bio, "text"],
        ["university", submission.university, "line"],
        ["fieldOfStudy", submission.fieldOfStudy, "line"],
      ];
  }
}

/** Share of words two texts have in common (Jaccard index of their word sets). */
export function similarity(a: string, b: string): number {
  const left = new Set(wordsOf(a));
  const right = new Set(wordsOf(b));
  if (left.size === 0 || right.size === 0) return 0;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / (left.size + right.size - shared);
}

export async function evaluateSubmission(submission: Submission, context: EvaluationContext): Promise<Evaluation> {
  const result: Evaluation = { decision: "allow", reasons: [], fieldErrors: {}, finalUrl: null, reputation: "unknown" };
  // Resources and comments can wait for a moderator; ratings and profiles have no queue, so what
  // would wait is refused.
  const canWait = submission.kind === "resource" || submission.kind === "comment";

  const apply = (field: string, check: { decision: Decision; reasons: string[]; message?: ValidationKey }) => {
    const decision = check.decision === "needs_review" && !canWait ? "reject" : check.decision;
    result.reasons.push(...check.reasons);
    if (decision === "reject" && check.message && !(field in result.fieldErrors)) {
      result.fieldErrors[field] = check.message;
    }
    result.decision = worse(result.decision, decision);
  };

  for (const [field, value, kind] of textFields(submission)) {
    if (value) apply(field, checkText(value, TEXT_RULES[kind], { field, filter: context.filter }));
  }

  if (submission.kind === "comment" && context.trustLevel === 0 && countLinks(submission.body) > 0) {
    apply("body", { decision: "needs_review", reasons: ["trust.new_link"] });
  }

  if (submission.kind === "resource") {
    if (context.trustLevel === 0) apply("url", { decision: "needs_review", reasons: ["trust.new"] });

    const text = `${submission.title} ${submission.summary}`;
    if (
      (context.recentResources ?? []).some(
        (other) => similarity(text, `${other.title} ${other.summary}`) >= DUPLICATE_SIMILARITY,
      )
    ) {
      apply("title", { decision: "reject", reasons: ["text.duplicate"], message: "textDuplicate" });
    }

    const url = checkUrl(submission.url);
    apply("url", url);
    // Visiting the link takes time; not worth it for a submission that is refused anyway.
    if (url.decision !== "reject" && result.decision !== "reject" && context.inspectUrl) {
      const inspection = await context.inspectUrl(url.url);
      apply("url", inspection);
      result.finalUrl = inspection.finalUrl;
      result.reputation = inspection.reputation;
    }
  }

  return result;
}

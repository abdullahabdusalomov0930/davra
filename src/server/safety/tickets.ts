import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/server/supabase/admin";

import type { Submission } from "./evaluate";
import type { Reputation } from "./reputation";

/**
 * Safety tickets (DECISIONS.md D64): after its checks the server tells the database "this user may
 * write exactly this content", and the database refuses Data API writes of user texts without such a
 * ticket. A ticket is bound to the content by a hash, used once, and expires after 15 minutes.
 */

export type SafetyKind = "resource" | "comment" | "rating" | "profile";

const UNIT_SEPARATOR = String.fromCharCode(31);

/** Same as private.content_hash() in the database: SHA-256 of the fields joined with U+001F. */
export function contentHash(parts: readonly (string | null)[]): string {
  return createHash("sha256")
    .update(parts.map((part) => part ?? "").join(UNIT_SEPARATOR), "utf8")
    .digest("hex");
}

/** The fields a ticket covers, in the order the database triggers hash them. */
export function ticketParts(submission: Submission): (string | null)[] {
  switch (submission.kind) {
    case "resource":
      return [submission.url, submission.title, submission.summary, submission.forWhom, submission.authorReview];
    case "comment":
      // resource_id::text in the database: lower case.
      return [submission.resourceId.toLowerCase(), submission.body];
    case "rating":
      return [submission.resourceId.toLowerCase(), submission.reviewText];
    case "profile":
      return [
        submission.username,
        submission.displayName,
        submission.bio,
        submission.university,
        submission.fieldOfStudy,
      ];
  }
}

export async function issueTicket(
  userId: string,
  submission: Submission,
  {
    decision,
    finalUrl = null,
    reputation = null,
  }: {
    decision: "allow" | "needs_review";
    finalUrl?: string | null;
    reputation?: Reputation | null;
  },
) {
  const { error } = await createAdminClient().rpc("issue_safety_ticket", {
    for_user: userId,
    kind: submission.kind,
    content_hash: contentHash(ticketParts(submission)),
    decision,
    final_url: finalUrl ?? undefined,
    reputation: reputation ?? undefined,
  });
  if (error) throw error;
}

/**
 * Why the check held back or refused a submission, for moderators. Never shown to the author. A
 * failure here must not fail the submission: it is logged and forgotten.
 */
export async function recordModerationEvent(event: {
  userId: string;
  targetType: SafetyKind;
  targetId?: string | null;
  decision: "needs_review" | "reject";
  reasons: readonly string[];
  excerpt: string;
}) {
  const { error } = await createAdminClient()
    .from("moderation_events")
    .insert({
      user_id: event.userId,
      target_type: event.targetType,
      target_id: event.targetId ?? null,
      decision: event.decision,
      reasons: [...event.reasons],
      excerpt: [...event.excerpt].slice(0, 300).join(""),
    });
  if (error) console.error("recordModerationEvent failed", { code: error.code });
}

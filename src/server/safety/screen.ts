import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ValidationKey } from "@/lib/validators";

import { evaluateSubmission, type Submission } from "./evaluate";
import { getReputationProvider } from "./reputation";
import { botUserAgent } from "./safe-fetch";
import { issueTicket, recordModerationEvent } from "./tickets";
import { inspectUrl } from "./url-policy";

/**
 * Runs the safety check before a user's text is written (DECISIONS.md D64): evaluates the submission
 * as that user, records refusals for moderators, and issues the ticket the database asks for.
 */

export type Screening =
  | { ok: false; fieldErrors: Record<string, ValidationKey> }
  | {
      ok: true;
      /** The submission waits for a moderator. */
      held: boolean;
      /** Tells moderators why the written resource or comment was held (no-op when it was not). */
      recordHeld(targetId: string): Promise<void>;
    };

const DAY_MS = 24 * 60 * 60 * 1000;

function excerptOf(submission: Submission) {
  switch (submission.kind) {
    case "resource":
      return `${submission.title} — ${submission.summary}`;
    case "comment":
      return submission.body;
    case "rating":
      return submission.reviewText ?? "";
    case "profile":
      return [submission.displayName, submission.username, submission.bio].filter(Boolean).join(" — ");
  }
}

export async function screenSubmission(
  userId: string,
  submission: Submission,
  { editing }: { editing?: string } = {},
): Promise<Screening> {
  const supabase = await createClient();

  const recent = async () => {
    if (submission.kind !== "resource") return [];
    let query = supabase
      .from("resources")
      .select("title, summary")
      .eq("author_id", userId)
      .gte("created_at", new Date(Date.now() - DAY_MS).toISOString())
      .limit(20);
    if (editing) query = query.neq("id", editing);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const [trust, recentResources] = await Promise.all([supabase.rpc("my_trust_level"), recent()]);
  if (trust.error) throw trust.error;

  const evaluation = await evaluateSubmission(submission, {
    trustLevel: trust.data ?? 0,
    recentResources,
    inspectUrl: (url) => inspectUrl(url, { userAgent: botUserAgent(), reputation: getReputationProvider() }),
  });

  const event = { userId, targetType: submission.kind, reasons: evaluation.reasons, excerpt: excerptOf(submission) };
  if (evaluation.decision === "reject") {
    await recordModerationEvent({ ...event, decision: "reject" });
    return { ok: false, fieldErrors: evaluation.fieldErrors };
  }

  await issueTicket(userId, submission, {
    decision: evaluation.decision,
    finalUrl: evaluation.finalUrl,
    reputation: evaluation.reputation,
  });
  const held = evaluation.decision === "needs_review";
  return {
    ok: true,
    held,
    async recordHeld(targetId) {
      if (held) await recordModerationEvent({ ...event, decision: "needs_review", targetId });
    },
  };
}

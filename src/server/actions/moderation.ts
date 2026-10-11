"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";

import type { ActionResult } from "@/lib/action-result";
import {
  BAN_LENGTHS,
  type BlockedDomainInput,
  blockedDomainSchema,
  type BlockedTermInput,
  blockedTermSchema,
  type ModerationInput,
  moderationSchema,
  type SettingsInput,
  settingsSchema,
  type TopicInput,
  topicSchema,
} from "@/lib/validators";
import { getStaffProfile, getViewer, hasRecentSignIn } from "@/server/auth/session";
import { requiresRecentLoginForAdmin } from "@/server/env";
import type { LinkCheckOutcome } from "@/server/link-check/check-link";
import { recheckLink } from "@/server/link-check/job";
import {
  addBlockedDomain,
  addBlockedTerm,
  banUser,
  createTopic,
  decideLinkStatus,
  decidePendingAction,
  deleteContent,
  deleteTopic,
  handleAppeal,
  handleRemovalRequest,
  handleReports,
  type Moderation,
  moderateComment,
  moderateResource,
  removeBlockedDomain,
  removeBlockedTerm,
  requestAction,
  setSevereIncidentStatus,
  setTrustLevel,
  setUserRole,
  updateSettings,
  updateTopic,
  warnUser,
} from "@/server/services/moderation";
import { Constants } from "@/types/database";

import { toFieldErrors } from "./validation";

// Every action runs as the signed-in staff member: RLS, the guard triggers and the moderation
// functions decide what each role may do, and the audit log records it with the reason (D15, D16,
// D71). These checks only reject malformed input early.

const id = z.uuid();
const enums = Constants.public.Enums;

type ModerationResult = ActionResult<keyof ModerationInput>;

/** Validates, runs, and refreshes every page (statuses show up in feeds, queues and resource pages). */
async function run<T extends ActionResult<string>>(
  valid: boolean,
  action: () => Promise<T>,
): Promise<T | ActionResult> {
  if (!(await getViewer())) return { ok: false, error: "unauthorized" };
  if (!valid) return { ok: false, error: "invalidInput" };
  // Optional hardening (REQUIRE_RECENT_LOGIN_FOR_ADMIN): admins sign in again before acting.
  if (requiresRecentLoginForAdmin() && (await getStaffProfile())?.role === "admin" && !(await hasRecentSignIn())) {
    return { ok: false, error: "reauthRequired" };
  }
  const result = await action();
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Like run(), for actions that carry a reason: its errors go to the dialog's fields. */
async function moderate(
  valid: boolean,
  input: ModerationInput,
  action: (moderation: Moderation) => Promise<ActionResult>,
): Promise<ModerationResult> {
  const parsed = moderationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof ModerationInput>(parsed.error) };
  }
  return run(valid, () => action(parsed.data));
}

export async function moderateResourceAction(resourceId: string, status: string, input: ModerationInput) {
  const parsed = z.enum(enums.resource_status).safeParse(status);
  return moderate(id.safeParse(resourceId).success && parsed.success, input, (moderation) =>
    moderateResource(resourceId, parsed.data!, moderation),
  );
}

export async function moderateCommentAction(commentId: string, status: string, input: ModerationInput) {
  const parsed = z.enum(enums.comment_status).safeParse(status);
  return moderate(id.safeParse(commentId).success && parsed.success, input, (moderation) =>
    moderateComment(commentId, parsed.data!, moderation),
  );
}

/** Admins delete at once; a moderator's "delete" asks an admin to confirm it. */
export async function deleteContentAction(targetType: string, targetId: string, input: ModerationInput) {
  const parsed = z.enum(["resource", "comment"]).safeParse(targetType);
  const staff = await getStaffProfile();
  return moderate(id.safeParse(targetId).success && parsed.success, input, (moderation) =>
    staff?.role === "admin"
      ? deleteContent(parsed.data!, targetId, moderation)
      : requestAction(parsed.data === "resource" ? "delete_resource" : "delete_comment", targetId, moderation),
  );
}

/** `length`: "1", "7" or "30" days, or "permanent" (an admin's confirmation for moderators). */
export async function banUserAction(userId: string, length: string, input: ModerationInput) {
  const parsed = z.enum(BAN_LENGTHS).safeParse(length);
  const staff = await getStaffProfile();
  return moderate(id.safeParse(userId).success && parsed.success, input, (moderation) => {
    if (parsed.data !== "permanent") return banUser(userId, Number(parsed.data), moderation);
    return staff?.role === "admin"
      ? banUser(userId, null, moderation)
      : requestAction("permanent_ban", userId, moderation);
  });
}

export async function unbanUserAction(userId: string, input: ModerationInput) {
  return moderate(id.safeParse(userId).success, input, (moderation) => banUser(userId, 0, moderation));
}

export async function warnUserAction(userId: string, input: ModerationInput) {
  return moderate(id.safeParse(userId).success, input, (moderation) => warnUser(userId, moderation));
}

export async function setUserRoleAction(userId: string, role: string, input: ModerationInput) {
  const parsed = z.enum(enums.user_role).safeParse(role);
  return moderate(id.safeParse(userId).success && parsed.success, input, (moderation) =>
    setUserRole(userId, parsed.data!, moderation),
  );
}

/** `level`: "0"–"3", or "auto" to give the user back to the automatic rules. */
export async function setTrustLevelAction(userId: string, level: string, input: ModerationInput) {
  const parsed = z.enum(["0", "1", "2", "3", "auto"]).safeParse(level);
  return moderate(id.safeParse(userId).success && parsed.success, input, (moderation) =>
    setTrustLevel(userId, parsed.data === "auto" ? null : Number(parsed.data), moderation),
  );
}

/** Decides every open report about one resource, comment or user. */
export async function handleReportsAction(
  targetType: string,
  targetId: string,
  decision: string,
  input: ModerationInput,
) {
  const type = z.enum(["resource", "comment", "user"]).safeParse(targetType);
  const choice = z.enum(["take_down", "resolve", "dismiss"]).safeParse(decision);
  return moderate(id.safeParse(targetId).success && type.success && choice.success, input, (moderation) =>
    handleReports(type.data!, targetId, choice.data!, moderation),
  );
}

export async function handleAppealAction(appealId: string, accept: boolean, input: ModerationInput) {
  return moderate(id.safeParse(appealId).success && typeof accept === "boolean", input, (moderation) =>
    handleAppeal(appealId, accept, moderation),
  );
}

export async function handleRemovalRequestAction(requestId: string, status: string, input: ModerationInput) {
  const parsed = z.enum(["resolved", "dismissed"]).safeParse(status);
  return moderate(id.safeParse(requestId).success && parsed.success, input, (moderation) =>
    handleRemovalRequest(requestId, parsed.data!, moderation),
  );
}

/** An admin confirms or turns down a moderator's request; the note is optional. */
export async function decidePendingActionAction(actionId: string, approve: boolean, input: ModerationInput) {
  return moderate(id.safeParse(actionId).success && typeof approve === "boolean", input, (moderation) =>
    decidePendingAction(actionId, approve, moderation.reason),
  );
}

export async function setSevereIncidentAction(incidentId: string, status: string, input: ModerationInput) {
  const parsed = z.enum(["preserved", "closed"]).safeParse(status);
  return moderate(id.safeParse(incidentId).success && parsed.success, input, (moderation) =>
    setSevereIncidentStatus(incidentId, parsed.data!, moderation.reason),
  );
}

/** "Ishlamayapti" / "Ishlayapti" on the Havolalar page; also closes the link's open reports. */
export async function decideLinkAction(resourceId: string, linkStatus: string) {
  const parsed = z.enum(["ok", "broken"]).safeParse(linkStatus);
  return run(id.safeParse(resourceId).success && parsed.success, () => decideLinkStatus(resourceId, parsed.data!));
}

type Recheck = { outcome: LinkCheckOutcome; linkStatus: (typeof enums.link_status)[number] | null };

/**
 * "Hozir tekshirish": runs the link checker on one link now. The exception to the rule above: the
 * checker records its result with the secret key, like the scheduled run (D56), so staff are checked
 * here. It records what the checker saw, never a person's decision.
 */
export async function recheckLinkAction(resourceId: string): Promise<ActionResult<never, Recheck>> {
  if (!(await getStaffProfile())) return { ok: false, error: "forbidden" };
  if (!id.safeParse(resourceId).success) return { ok: false, error: "invalidInput" };

  const result = await recheckLink(resourceId);
  if (!result) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true, outcome: result.outcome, linkStatus: result.linkStatus };
}

export async function createTopicAction(input: TopicInput): Promise<ActionResult<keyof TopicInput>> {
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof TopicInput>(parsed.error) };
  }
  return run(true, () => createTopic(parsed.data));
}

export async function updateTopicAction(topicId: string, input: TopicInput): Promise<ActionResult<keyof TopicInput>> {
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof TopicInput>(parsed.error) };
  }
  return run(id.safeParse(topicId).success, () => updateTopic(topicId, parsed.data));
}

export async function deleteTopicAction(topicId: string) {
  return run(id.safeParse(topicId).success, () => deleteTopic(topicId));
}

export async function addDomainAction(input: BlockedDomainInput): Promise<ActionResult<keyof BlockedDomainInput>> {
  const parsed = blockedDomainSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof BlockedDomainInput>(parsed.error) };
  }
  return run(true, () => addBlockedDomain(parsed.data));
}

export async function removeDomainAction(domain: string) {
  return run(typeof domain === "string" && domain.length <= 253, () => removeBlockedDomain(domain));
}

export async function addTermAction(input: BlockedTermInput): Promise<ActionResult<keyof BlockedTermInput>> {
  const parsed = blockedTermSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof BlockedTermInput>(parsed.error) };
  }
  return run(true, () => addBlockedTerm(parsed.data));
}

export async function removeTermAction(term: string) {
  return run(typeof term === "string" && term.length <= 80, () => removeBlockedTerm(term));
}

export async function updateSettingsAction(input: SettingsInput): Promise<ActionResult<keyof SettingsInput>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof SettingsInput>(parsed.error) };
  }
  return run(true, () => updateSettings(parsed.data));
}

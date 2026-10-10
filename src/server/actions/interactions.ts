"use server";

import { z } from "@/lib/zod";

import type { ActionResult } from "@/lib/action-result";
import { type CommentInput, commentSchema, type RatingInput, ratingSchema } from "@/lib/validators";
import { getViewer } from "@/server/auth/session";
import { setFollow } from "@/server/services/follows";
import { addComment, deleteComment, deleteRating, saveRating, setInteraction } from "@/server/services/interactions";

import { toFieldErrors } from "./validation";

const idSchema = z.uuid();
const flagSchema = z.boolean();

/** The signed-in user's id, or the result to return instead. */
async function viewerOrError(...ids: unknown[]): Promise<{ id: string } | ActionResult<never>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  if (!ids.every((id) => idSchema.safeParse(id).success)) return { ok: false, error: "invalidInput" };
  return { id: viewer.id };
}

const isError = (value: { id: string } | ActionResult<never>): value is ActionResult<never> => "ok" in value;

export async function setLikeAction(resourceId: string, liked: boolean): Promise<ActionResult> {
  const viewer = await viewerOrError(resourceId);
  if (isError(viewer)) return viewer;
  if (!flagSchema.safeParse(liked).success) return { ok: false, error: "invalidInput" };
  return setInteraction("resource_likes", viewer.id, resourceId, liked);
}

export async function setSaveAction(resourceId: string, saved: boolean): Promise<ActionResult> {
  const viewer = await viewerOrError(resourceId);
  if (isError(viewer)) return viewer;
  if (!flagSchema.safeParse(saved).success) return { ok: false, error: "invalidInput" };
  return setInteraction("resource_saves", viewer.id, resourceId, saved);
}

export async function saveRatingAction(
  resourceId: string,
  input: RatingInput,
): Promise<ActionResult<keyof RatingInput>> {
  const viewer = await viewerOrError(resourceId);
  if (isError(viewer)) return viewer;

  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof RatingInput>(parsed.error) };
  }
  return saveRating(viewer.id, resourceId, parsed.data);
}

export async function deleteRatingAction(resourceId: string): Promise<ActionResult> {
  const viewer = await viewerOrError(resourceId);
  if (isError(viewer)) return viewer;
  return deleteRating(viewer.id, resourceId);
}

export async function addCommentAction(
  resourceId: string,
  input: CommentInput,
): Promise<ActionResult<keyof CommentInput>> {
  const viewer = await viewerOrError(resourceId);
  if (isError(viewer)) return viewer;

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof CommentInput>(parsed.error) };
  }
  return addComment(resourceId, parsed.data);
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  const viewer = await viewerOrError(commentId);
  if (isError(viewer)) return viewer;
  return deleteComment(viewer.id, commentId);
}

export async function setFollowUserAction(userId: string, follow: boolean): Promise<ActionResult> {
  const viewer = await viewerOrError(userId);
  if (isError(viewer)) return viewer;
  if (!flagSchema.safeParse(follow).success) return { ok: false, error: "invalidInput" };
  if (userId === viewer.id) return { ok: false, error: "forbidden" };
  return setFollow(viewer.id, { kind: "user", id: userId }, follow);
}

export async function setFollowTopicAction(topicId: string, follow: boolean): Promise<ActionResult> {
  const viewer = await viewerOrError(topicId);
  if (isError(viewer)) return viewer;
  if (!flagSchema.safeParse(follow).success) return { ok: false, error: "invalidInput" };
  return setFollow(viewer.id, { kind: "topic", id: topicId }, follow);
}

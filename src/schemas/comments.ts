import { z } from "zod";
import { id, page, perPage } from "./common.js";

/** Comments can live on tasks, groups, or projects — the API uses the plural in the path. */
export const commentTarget = z
  .enum(["tasks", "groups", "projects"])
  .describe("What the comment is attached to: a task, group, or project");

export const commentType = z
  .enum(["comment", "note"])
  .describe("'comment' is a discussion entry; 'note' is a standalone note");

const targetFields = {
  target: commentTarget,
  target_id: id.describe("ID of the task, group, or project"),
};

export const listComments = {
  ...targetFields,
  type: commentType.optional().describe("Filter by comment type"),
  page,
  per_page: perPage,
};

export const createComment = {
  ...targetFields,
  message: z.string().min(1).max(10000).describe("The comment body text"),
  type: commentType.optional().describe("Defaults to 'comment'"),
  users_emailed: z
    .array(id)
    .optional()
    .describe("User IDs to notify via email about this comment (for @mentions)"),
};

export const updateComment = {
  ...targetFields,
  comment_id: id.describe("ID of the comment to update"),
  message: z.string().min(1).max(10000).describe("The updated comment text"),
};

export const deleteComment = {
  ...targetFields,
  comment_id: id.describe("ID of the comment to delete"),
};

export const pinComment = {
  ...targetFields,
  comment_id: id.describe("ID of the comment to pin or unpin"),
  pinned: z.boolean().describe("true to pin the comment to the top, false to unpin"),
};

export const listDiscussions = {
  project_ids: z.array(id).optional().describe("Filter discussions by project IDs"),
  is_unread: z.boolean().optional().describe("Only discussions with unread items"),
  is_mentioned: z
    .boolean()
    .optional()
    .describe("Only discussions where the current user is mentioned"),
  has_unread_mention: z
    .boolean()
    .optional()
    .describe("Only discussions with unread mentions of the current user"),
  is_my_task: z
    .boolean()
    .optional()
    .describe("Only discussions on tasks assigned to the current user"),
  offset: z.number().int().min(0).optional().describe("Pagination offset"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Maximum discussions to return (default 50)"),
};

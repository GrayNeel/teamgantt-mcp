import * as schema from "../schemas/comments.js";
import { trimComments, trimDiscussions } from "./trim.js";
import { run, type ToolModule } from "./types.js";

export const registerCommentTools: ToolModule = (server, client) => {
  server.registerTool(
    "list_comments",
    {
      title: "List comments",
      description:
        "List comments/notes on a task, group, or project (paginated). " +
        "Use this to read the discussion before replying or summarizing.",
      inputSchema: schema.listComments,
      annotations: { readOnlyHint: true },
    },
    async ({ target, target_id, ...query }) =>
      run(async () =>
        trimComments(await client.get(`/v1/${target}/${target_id}/comments`, query)),
      ),
  );

  server.registerTool(
    "create_comment",
    {
      title: "Create comment",
      description:
        "Post a comment or note on a task, group, or project. " +
        "Use users_emailed to notify specific people (@mention behavior).",
      inputSchema: schema.createComment,
    },
    async ({ target, target_id, ...body }) =>
      run(() => client.post(`/v1/${target}/${target_id}/comments`, body)),
  );

  server.registerTool(
    "update_comment",
    {
      title: "Update comment",
      description: "Edit the text of an existing comment.",
      inputSchema: schema.updateComment,
    },
    async ({ target, target_id, comment_id, ...body }) =>
      run(() => client.patch(`/v1/${target}/${target_id}/comments/${comment_id}`, body)),
  );

  server.registerTool(
    "delete_comment",
    {
      title: "Delete comment",
      description: "Permanently delete a comment. Cannot be undone.",
      inputSchema: schema.deleteComment,
      annotations: { destructiveHint: true },
    },
    async ({ target, target_id, comment_id }) =>
      run(() => client.delete(`/v1/${target}/${target_id}/comments/${comment_id}`)),
  );

  server.registerTool(
    "pin_comment",
    {
      title: "Pin or unpin comment",
      description: "Pin a comment to the top of its comment list, or unpin it.",
      inputSchema: schema.pinComment,
    },
    async ({ target, target_id, comment_id, pinned }) =>
      run(() =>
        client.post(`/v1/${target}/${target_id}/comments/${comment_id}/pin`, { pinned }),
      ),
  );

  server.registerTool(
    "list_discussions",
    {
      title: "List discussions",
      description:
        "Cross-project discussion inbox for the current user: comment threads with unread/mention/starred " +
        "filters. Use this to find what needs attention, then list_comments on a specific item.",
      inputSchema: schema.listDiscussions,
      annotations: { readOnlyHint: true },
    },
    async ({ project_ids, limit, ...rest }) =>
      run(async () =>
        trimDiscussions(
          await client.get("/v1/discussions", {
            ...rest,
            // Default well below the API's 500 to keep responses context-friendly.
            limit: limit ?? 50,
            "project_id[]": project_ids,
          }),
        ),
      ),
  );
};

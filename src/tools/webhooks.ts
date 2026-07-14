import * as schema from "../schemas/webhooks.js";
import { run, type ToolModule } from "./types.js";

/** The API exposes only list and create — there is no delete/update webhook endpoint. */
export const registerWebhookTools: ToolModule = (server, client) => {
  server.registerTool(
    "list_webhooks",
    {
      title: "List webhooks",
      description: "List webhook subscriptions created by the current user.",
      inputSchema: schema.listWebhooks,
      annotations: { readOnlyHint: true },
    },
    async () => run(() => client.get("/v1/webhooks")),
  );

  server.registerTool(
    "create_webhook",
    {
      title: "Create webhook",
      description:
        "Subscribe an external URL to project events (task_created/task_updated/task_deleted). " +
        "Requires project admin. Note: the TeamGantt API has no endpoint to delete a webhook.",
      inputSchema: schema.createWebhook,
    },
    async (input) => run(() => client.post("/v1/webhooks", { target_type: "project", ...input })),
  );
};

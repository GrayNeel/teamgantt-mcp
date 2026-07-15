import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TeamGanttClient } from "./client/teamgantt.js";
import { registerMcpResources } from "./mcp-resources.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerPeopleTools } from "./tools/people.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerReportTools } from "./tools/reports.js";
import { registerResourceTools } from "./tools/resources.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerTimeTrackingTools } from "./tools/time-tracking.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerWorkloadTools } from "./tools/workload.js";
import type { ToolModule } from "./tools/types.js";

export const SERVER_NAME = "teamgantt";
export const SERVER_VERSION = "0.6.0";

/** Add new API domains here — one ToolModule per domain. */
const TOOL_MODULES: ToolModule[] = [
  registerProjectTools,
  registerTaskTools,
  registerTimeTrackingTools,
  registerCommentTools,
  registerPeopleTools,
  registerResourceTools,
  registerWorkloadTools,
  registerReportTools,
  registerWebhookTools,
];

export function createServer(client: TeamGanttClient): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  for (const register of TOOL_MODULES) {
    register(server, client);
  }
  registerMcpResources(server, client);

  return server;
}

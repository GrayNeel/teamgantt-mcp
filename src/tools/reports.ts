import * as schema from "../schemas/reports.js";
import { run, type ToolModule } from "./types.js";

/**
 * Only the modern health endpoint is exposed: the legacy
 * /v1/reports/project_health embeds full project objects (~14 KB for one
 * project vs ~170 B here), and the spec's beta /v1/reports/time-tracking
 * 404s on the live API (verified July 2026) — use get_timesheets instead.
 */
export const registerReportTools: ToolModule = (server, client) => {
  server.registerTool(
    "get_project_health",
    {
      title: "Get project health report",
      description:
        "Health metrics for one or more projects: task counts by status " +
        "(on_schedule/overdue/behind/upcoming) and duration-weighted percent complete. " +
        "Compact — safe to call for many projects at once.",
      inputSchema: schema.getProjectHealth,
      annotations: { readOnlyHint: true },
    },
    async ({ project_ids }) =>
      run(() => client.get("/v1/reports/health/project", { "ids[]": project_ids })),
  );
};

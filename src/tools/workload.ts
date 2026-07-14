import * as schema from "../schemas/workload.js";
import { trimWorkload } from "./trim.js";
import { run, type ToolModule } from "./types.js";

/**
 * Workload endpoints report allocated hours per date (grouped by day/week/
 * month). Unlike most array params, these endpoints take comma-separated
 * `ids` / `project_ids` strings rather than repeated `[]` keys.
 */
export const registerWorkloadTools: ToolModule = (server, client) => {
  server.registerTool(
    "get_user_workload",
    {
      title: "Get user workload",
      description:
        "Allocated hours per date for one or more users — how busy they are and which days " +
        "have capacity. Use list_company_users or get_current_user to find user IDs.",
      inputSchema: schema.getUserWorkload,
      annotations: { readOnlyHint: true },
    },
    async ({ user_ids, project_ids, ...rest }) =>
      run(async () =>
        trimWorkload(
          await client.get("/v1/workload/users", {
            ...rest,
            ids: user_ids.join(","),
            project_ids: project_ids?.join(","),
          }),
        ),
      ),
  );

  server.registerTool(
    "get_unassigned_workload",
    {
      title: "Get unassigned workload",
      description:
        "Hours per date on tasks that have no assignees — work that still needs an owner.",
      inputSchema: schema.getUnassignedWorkload,
      annotations: { readOnlyHint: true },
    },
    async ({ project_ids, ...rest }) =>
      run(async () =>
        trimWorkload(
          await client.get("/v1/workload/unassigned", {
            ...rest,
            project_ids: project_ids?.join(","),
          }),
        ),
      ),
  );

  server.registerTool(
    "get_resource_workload",
    {
      title: "Get resource workload",
      description:
        "Allocated hours per date for company or project resources (equipment, rooms, labels).",
      inputSchema: schema.getResourceWorkload,
      annotations: { readOnlyHint: true },
    },
    async ({ resource_type, resource_ids, ...rest }) =>
      run(async () =>
        trimWorkload(
          await client.get(`/v1/workload/${resource_type}_resources`, {
            ...rest,
            ids: resource_ids.join(","),
          }),
        ),
      ),
  );
};

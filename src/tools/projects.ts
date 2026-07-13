import * as schema from "../schemas/projects.js";
import { summarizeTree, trimProjectList } from "./trim.js";
import { run, type ToolModule } from "./types.js";

export const registerProjectTools: ToolModule = (server, client) => {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List TeamGantt projects accessible to the current user (compact summaries — use get_project for full details). " +
        "Defaults to active projects; use the status filter for on-hold/complete projects. Use this first to discover project IDs.",
      inputSchema: schema.listProjects,
      annotations: { readOnlyHint: true },
    },
    async ({ company_ids, ...rest }) =>
      run(async () =>
        trimProjectList(
          await client.get("/v1/projects", { ...rest, "company_ids[]": company_ids }),
        ),
      ),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description:
        "Get full details of a TeamGantt project: metadata, status, dates, settings, user accesses and team assignments.",
      inputSchema: schema.getProject,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => run(() => client.get(`/v1/projects/${project_id}`)),
  );

  server.registerTool(
    "get_project_children",
    {
      title: "Get project structure (group tree)",
      description:
        "Get the group tree of a project with per-group task counts — use this to find parent_group_id " +
        "values needed when creating tasks. Set include_tasks for minimal task entries; " +
        "for browsing tasks in detail use the paginated list_tasks instead.",
      inputSchema: schema.getProjectChildren,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, include_tasks }) =>
      run(async () =>
        summarizeTree(
          await client.get(`/v1/projects/${project_id}/children`),
          include_tasks ?? false,
        ),
      ),
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description:
        "Create a new TeamGantt project in a company, optionally from a template. " +
        "Requires the company_id (visible on projects returned by list_projects).",
      inputSchema: schema.createProject,
    },
    async (input) => run(() => client.post("/v1/projects", input)),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description:
        "Update settings of an existing project (name, status, default view, working days, hour tracking). Partial update — send only the fields to change.",
      inputSchema: schema.updateProject,
    },
    async ({ project_id, ...body }) =>
      run(() => client.patch(`/v1/projects/${project_id}`, body)),
  );

  server.registerTool(
    "archive_project",
    {
      title: "Archive project",
      description:
        "Archive (soft-delete) a project. It disappears from normal project lists but is not permanently deleted.",
      inputSchema: schema.archiveProject,
      annotations: { destructiveHint: true },
    },
    async ({ project_id }) => run(() => client.delete(`/v1/projects/${project_id}`)),
  );
};

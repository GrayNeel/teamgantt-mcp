import * as schema from "../schemas/resources.js";
import { trimResourceOptions } from "./trim.js";
import { run, type ToolModule } from "./types.js";

/**
 * Resources are the non-user things that can be assigned to tasks (equipment,
 * rooms, labels). Company resources are shared across projects; project
 * resources exist in a single project. Users are assigned via the task
 * assignment tools — see get_project_resource_options for what's assignable.
 */
export const registerResourceTools: ToolModule = (server, client) => {
  server.registerTool(
    "get_project_resource_options",
    {
      title: "Get assignable resources for a project",
      description:
        "Everything that can be assigned to tasks in a project: users (compact), company resources, " +
        "and project-specific resources. Use this to find IDs for assign_task_resource.",
      inputSchema: schema.getProjectResourceOptions,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) =>
      run(async () =>
        trimResourceOptions(await client.get(`/v1/projects/${project_id}/resource_options`)),
      ),
  );

  server.registerTool(
    "list_project_resources",
    {
      title: "List project resources",
      description:
        "List resources (labels) that exist only within one project, not company-wide.",
      inputSchema: schema.listProjectResources,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) =>
      run(() => client.get(`/v1/projects/${project_id}/resources/project`)),
  );

  server.registerTool(
    "create_project_resource",
    {
      title: "Create project resource",
      description: "Create a resource (label) specific to one project.",
      inputSchema: schema.createProjectResource,
    },
    async ({ project_id, ...body }) =>
      run(() => client.post(`/v1/projects/${project_id}/resources/project`, body)),
  );

  server.registerTool(
    "update_project_resource",
    {
      title: "Update project resource",
      description: "Rename a project-specific resource.",
      inputSchema: schema.updateProjectResource,
    },
    async ({ project_id, resource_id, ...body }) =>
      run(() => client.patch(`/v1/projects/${project_id}/resources/${resource_id}`, body)),
  );

  server.registerTool(
    "delete_project_resource",
    {
      title: "Delete project resource",
      description: "Permanently delete a project-specific resource. Cannot be undone.",
      inputSchema: schema.deleteProjectResource,
      annotations: { destructiveHint: true },
    },
    async ({ project_id, resource_id }) =>
      // The API only exposes delete on this route (the {resourceId} route has no DELETE).
      run(() => client.delete(`/v1/projects/${project_id}/resources/project/${resource_id}`)),
  );

  server.registerTool(
    "list_company_resources",
    {
      title: "List company resources",
      description:
        "List company-level resources (equipment, rooms, etc.) shared across all projects.",
      inputSchema: schema.listCompanyResources,
      annotations: { readOnlyHint: true },
    },
    async ({ company_id }) =>
      run(() => client.get(`/v1/companies/${company_id}/resources/company`)),
  );

  server.registerTool(
    "create_company_resource",
    {
      title: "Create company resource",
      description: "Create a company-level resource available to every project.",
      inputSchema: schema.createCompanyResource,
    },
    async ({ company_id, ...body }) =>
      run(() => client.post(`/v1/companies/${company_id}/resources/company`, body)),
  );

  server.registerTool(
    "update_company_resource",
    {
      title: "Update company resource",
      description: "Rename a company-level resource.",
      inputSchema: schema.updateCompanyResource,
    },
    async ({ company_id, resource_id, ...body }) =>
      run(() =>
        client.patch(`/v1/companies/${company_id}/resources/company/${resource_id}`, body),
      ),
  );

  server.registerTool(
    "delete_company_resource",
    {
      title: "Delete company resource",
      description: "Permanently delete a company resource. Cannot be undone.",
      inputSchema: schema.deleteCompanyResource,
      annotations: { destructiveHint: true },
    },
    async ({ company_id, resource_id }) =>
      run(() =>
        client.delete(`/v1/companies/${company_id}/resources/company/${resource_id}`),
      ),
  );

  server.registerTool(
    "add_company_resource_to_project",
    {
      title: "Add company resource to project",
      description:
        "Make a company resource assignable in a project, with a project-specific color. " +
        "Returns the link — its id is what remove_company_resource_from_project needs.",
      inputSchema: schema.addCompanyResourceToProject,
    },
    async ({ project_id, ...body }) =>
      run(() => client.post(`/v1/projects/${project_id}/resources/company`, body)),
  );

  server.registerTool(
    "remove_company_resource_from_project",
    {
      title: "Remove company resource from project",
      description:
        "Remove a company resource from a project (the resource itself is not deleted).",
      inputSchema: schema.removeCompanyResourceFromProject,
      annotations: { destructiveHint: true },
    },
    async ({ project_id, company_resource_option_id }) =>
      run(() =>
        client.delete(
          `/v1/projects/${project_id}/company_resource_options/${company_resource_option_id}`,
        ),
      ),
  );
};

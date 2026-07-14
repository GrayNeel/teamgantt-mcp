import * as schema from "../schemas/people.js";
import { trimCompanyProjects, trimCompanyUsers, trimCurrentUser } from "./trim.js";
import { run, type ToolModule } from "./types.js";

export const registerPeopleTools: ToolModule = (server, client) => {
  server.registerTool(
    "get_current_user",
    {
      title: "Get current user",
      description:
        "Get the authenticated user's profile and their companies (compact summary). " +
        "Use this first to discover your user_id and company_id for other tools.",
      inputSchema: schema.getCurrentUser,
      annotations: { readOnlyHint: true },
    },
    async () => run(async () => trimCurrentUser(await client.get("/v1/current_user"))),
  );

  server.registerTool(
    "get_company",
    {
      title: "Get company",
      description:
        "Get full details of a company: plan, feature flags, usage limits, and account holders.",
      inputSchema: schema.getCompany,
      annotations: { readOnlyHint: true },
    },
    async ({ company_id }) => run(() => client.get(`/v1/companies/${company_id}`)),
  );

  server.registerTool(
    "update_company",
    {
      title: "Update company",
      description: "Rename a company. Requires manage permissions on the company.",
      inputSchema: schema.updateCompany,
    },
    async ({ company_id, ...body }) =>
      run(() => client.patch(`/v1/companies/${company_id}`, body)),
  );

  server.registerTool(
    "list_company_users",
    {
      title: "List company users",
      description:
        "List all users in a company with their permission levels (compact summaries). " +
        "Use this to find user IDs for task assignments, comment @mentions, and workload queries.",
      inputSchema: schema.listCompanyUsers,
      annotations: { readOnlyHint: true },
    },
    async ({ company_id }) =>
      run(async () => trimCompanyUsers(await client.get(`/v1/companies/${company_id}/users`))),
  );

  server.registerTool(
    "get_company_user",
    {
      title: "Get company user",
      description:
        "Get details of a specific user in a company. Requires manage access to the company.",
      inputSchema: schema.getCompanyUser,
      annotations: { readOnlyHint: true },
    },
    async ({ company_id, user_id }) =>
      run(() => client.get(`/v1/companies/${company_id}/users/${user_id}`)),
  );

  server.registerTool(
    "invite_company_user",
    {
      title: "Invite user to company",
      description:
        "Invite a new user to the company (or add an existing TeamGantt user). " +
        "Provide either first_name/last_name or name.",
      inputSchema: schema.inviteCompanyUser,
    },
    async ({ company_id, ...body }) =>
      run(() => client.post(`/v1/companies/${company_id}/users`, body)),
  );

  server.registerTool(
    "update_company_user",
    {
      title: "Update company user",
      description:
        "Update a company user's permissions or disable them. Name and email can only be " +
        "changed while the user is still pending. Partial update — send only the fields to change.",
      inputSchema: schema.updateCompanyUser,
    },
    async ({ company_id, user_id, ...body }) =>
      run(() => client.patch(`/v1/companies/${company_id}/users/${user_id}`, body)),
  );

  server.registerTool(
    "remove_company_user",
    {
      title: "Remove user from company",
      description:
        "Remove a user from the company. They lose access to all company projects. Cannot remove yourself.",
      inputSchema: schema.removeCompanyUser,
      annotations: { destructiveHint: true },
    },
    async ({ company_id, user_id }) =>
      run(() => client.delete(`/v1/companies/${company_id}/users/${user_id}`)),
  );

  server.registerTool(
    "list_company_projects",
    {
      title: "List company projects",
      description:
        "List all projects in a company (compact summaries — use get_project for full details). " +
        "Unlike list_projects, this is scoped to one company and not filtered by status.",
      inputSchema: schema.listCompanyProjects,
      annotations: { readOnlyHint: true },
    },
    async ({ company_id }) =>
      run(async () =>
        trimCompanyProjects(await client.get(`/v1/companies/${company_id}/projects`)),
      ),
  );
};

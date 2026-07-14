import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import type { TeamGanttClient } from "./client/teamgantt.js";
import { summarizeTree, trimCurrentUser, trimProjectList } from "./tools/trim.js";

/**
 * Read-only MCP resources under the teamgantt:// scheme — the browsable
 * counterpart to the tool catalog. Same trimming rules as the tools:
 * list/tree resources are summaries, the single-project resource is full.
 */

function jsonContents(uri: URL, data: unknown): ReadResourceResult {
  return {
    contents: [
      { uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
    ],
  };
}

function projectIdFrom(variables: Variables): number {
  const raw = variables.projectId;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid projectId in resource URI: ${String(raw)}`);
  }
  return id;
}

export function registerMcpResources(server: McpServer, client: TeamGanttClient): void {
  server.registerResource(
    "current-user",
    "teamgantt://current-user",
    {
      title: "Current user",
      description: "Profile and companies of the authenticated TeamGantt user",
      mimeType: "application/json",
    },
    async (uri) => jsonContents(uri, trimCurrentUser(await client.get("/v1/current_user"))),
  );

  server.registerResource(
    "projects",
    "teamgantt://projects",
    {
      title: "Active projects",
      description: "Compact list of active TeamGantt projects",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonContents(uri, trimProjectList(await client.get("/v1/projects", { status: "active" }))),
  );

  server.registerResource(
    "project",
    new ResourceTemplate("teamgantt://projects/{projectId}", { list: undefined }),
    {
      title: "Project details",
      description: "Full details of one TeamGantt project",
      mimeType: "application/json",
    },
    async (uri, variables) =>
      jsonContents(uri, await client.get(`/v1/projects/${projectIdFrom(variables)}`)),
  );

  server.registerResource(
    "project-tree",
    new ResourceTemplate("teamgantt://projects/{projectId}/tree", { list: undefined }),
    {
      title: "Project structure",
      description: "Group tree of a project with per-group task counts",
      mimeType: "application/json",
    },
    async (uri, variables) =>
      jsonContents(
        uri,
        summarizeTree(await client.get(`/v1/projects/${projectIdFrom(variables)}/children`)),
      ),
  );
}

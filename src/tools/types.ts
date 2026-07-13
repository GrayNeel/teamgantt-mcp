import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TeamGanttApiError } from "../client/errors.js";
import type { TeamGanttClient } from "../client/teamgantt.js";

/** A tool module registers a related set of tools on the server. */
export type ToolModule = (server: McpServer, client: TeamGanttClient) => void;

/** Wrap a handler so API failures become structured isError results instead of crashes. */
export async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return jsonResult(await fn());
  } catch (error) {
    return errorResult(error);
  }
}

export function jsonResult(data: unknown): CallToolResult {
  const text = data === null || data === undefined ? "OK (no content)" : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

export function errorResult(error: unknown): CallToolResult {
  let text: string;
  if (error instanceof TeamGanttApiError) {
    text =
      `${error.message}\n` +
      hintForStatus(error.status);
  } else if (error instanceof Error) {
    text = `Request failed: ${error.message}`;
  } else {
    text = `Request failed: ${String(error)}`;
  }
  return { content: [{ type: "text", text }], isError: true };
}

function hintForStatus(status: number): string {
  switch (status) {
    case 401:
      return "Hint: the TEAMGANTT_API_TOKEN is missing, invalid, or expired.";
    case 403:
      return "Hint: the token's user lacks permission for this resource.";
    case 404:
      return "Hint: the resource does not exist or the user has no access to it. Verify the ID.";
    case 422:
    case 400:
      return "Hint: the request body was rejected. Check required fields and value formats (dates are YYYY-MM-DD).";
    case 429:
      return "Hint: rate limited even after retries. Wait before retrying.";
    default:
      return status >= 500 ? "Hint: TeamGantt server error. Retry later." : "";
  }
}

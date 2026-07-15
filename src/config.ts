export interface Config {
  /**
   * Personal access token. Optional: in HTTP mode clients may supply their
   * own token per session via the Authorization header; stdio mode still
   * requires it (enforced in index.ts).
   */
  apiToken: string | undefined;
  baseUrl: string;
  logLevel: "error" | "warn" | "info" | "debug";
  /**
   * Optional shared secret that gates the HTTP `/mcp` endpoint. When set,
   * clients must present it (as `X-API-Key` or `Authorization: Bearer`);
   * when unset, the endpoint is unprotected (stdio mode ignores it).
   */
  mcpApiKey: string | undefined;
}

const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;

export const MISSING_TOKEN_MESSAGE =
  "TEAMGANTT_API_TOKEN is not set. Create a personal access token at " +
  "https://app.teamgantt.com/admin/developers/tokens and export it, " +
  "e.g. TEAMGANTT_API_TOKEN=... teamgantt-mcp";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiToken = env.TEAMGANTT_API_TOKEN?.trim() || undefined;

  const baseUrl = (env.TEAMGANTT_BASE_URL?.trim() || "https://api.teamgantt.com").replace(/\/+$/, "");

  const mcpApiKey = env.MCP_API_KEY?.trim() || undefined;

  const logLevel = env.LOG_LEVEL?.trim().toLowerCase();
  return {
    apiToken,
    baseUrl,
    mcpApiKey,
    logLevel: LOG_LEVELS.includes(logLevel as Config["logLevel"])
      ? (logLevel as Config["logLevel"])
      : "info",
  };
}

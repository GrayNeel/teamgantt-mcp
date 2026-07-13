import { loadConfig } from "./config.js";
import { TeamGanttClient } from "./client/teamgantt.js";
import { createServer } from "./server.js";
import { runStdio } from "./transports/stdio.js";
import { runHttp } from "./transports/http.js";

function parseArgs(argv: string[]): { http: boolean; port: number } {
  const http = argv.includes("--http");
  const portIdx = argv.indexOf("--port");
  const portArg = portIdx >= 0 ? Number(argv[portIdx + 1]) : NaN;
  const port = Number.isInteger(portArg) && portArg > 0 ? portArg : Number(process.env.PORT) || 3000;
  return { http, port };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const client = new TeamGanttClient({
    token: config.apiToken,
    baseUrl: config.baseUrl,
  });

  if (args.http) {
    const allowedHosts = process.env.MCP_ALLOWED_HOSTS?.split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    await runHttp({
      port: args.port,
      ...(allowedHosts ? { allowedHosts } : {}),
      createServer: () => createServer(client),
    });
  } else {
    await runStdio(createServer(client));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

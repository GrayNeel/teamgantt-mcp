import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface HttpOptions {
  port: number;
  /**
   * Network interface to bind. Defaults to 127.0.0.1 (loopback only) for
   * safety; set to 0.0.0.0 to accept connections from outside the host —
   * required when running inside a container.
   */
  host?: string;
  /** Extra Host-header values to accept (DNS-rebinding protection). */
  allowedHosts?: string[];
  /**
   * Factory — each MCP session gets its own server instance bound to the
   * TeamGantt token that authenticated the session.
   */
  createServer: (apiToken: string) => McpServer;
  /**
   * Fallback TeamGantt token (from the environment) used when a client
   * doesn't send its own Authorization header. Without it, sessions that
   * don't authenticate are rejected with 401 — that's the multi-tenant mode.
   */
  defaultToken?: string;
}

function bearerToken(req: Request): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "");
  return match?.[1]?.trim() || undefined;
}

export async function runHttp(options: HttpOptions): Promise<HttpServer> {
  const { port, createServer } = options;
  const host = options.host ?? "127.0.0.1";
  // Mutated after listen with the actual bound port (supports port 0 in tests).
  const allowedHosts = ["127.0.0.1", "localhost", ...(options.allowedHosts ?? [])];

  const app = express();
  app.use(express.json());

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // The session is bound to the TeamGantt token presented at initialize:
      // per-client tokens make the HTTP transport multi-tenant, with the
      // environment token as a single-tenant fallback.
      const apiToken = bearerToken(req) ?? options.defaultToken;
      if (!apiToken) {
        res.status(401).json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message:
              "Unauthorized: send a TeamGantt personal access token as 'Authorization: Bearer <token>' " +
              "(or set TEAMGANTT_API_TOKEN on the server for single-tenant use)",
          },
          id: null,
        });
        return;
      }
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableDnsRebindingProtection: true,
        allowedHosts,
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) delete transports[transport.sessionId];
      };
      const server = createServer(apiToken);
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: no valid session ID provided" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // GET = server-to-client SSE stream, DELETE = session termination
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports[sessionId] : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transport.handleRequest(req, res);
  };
  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", sessions: Object.keys(transports).length });
  });

  const httpServer = await new Promise<HttpServer>((resolve) => {
    const s = app.listen(port, host, () => resolve(s));
  });
  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  allowedHosts.push(`127.0.0.1:${actualPort}`, `localhost:${actualPort}`);
  console.error(`teamgantt-mcp listening on http://${host}:${actualPort}/mcp`);
  return httpServer;
}

import type { Server as HttpServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { TeamGanttClient } from "../src/client/teamgantt.js";
import { createServer } from "../src/server.js";
import { runHttp, type HttpOptions } from "../src/transports/http.js";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HTTP transport multi-tenant auth", () => {
  let httpServer: HttpServer | undefined;

  afterEach(() => {
    httpServer?.close();
    httpServer = undefined;
  });

  async function startServer(fetchFn: typeof fetch, extra: Partial<HttpOptions> = {}) {
    httpServer = await runHttp({
      port: 0,
      createServer: (apiToken) =>
        createServer(
          new TeamGanttClient({
            token: apiToken,
            baseUrl: "https://api.example.com",
            fetchFn,
            sleepFn: async () => {},
            maxRetries: 0,
          }),
        ),
      ...extra,
    });
    const address = httpServer.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return new URL(`http://127.0.0.1:${port}/mcp`);
  }

  async function connect(url: URL, teamganttToken?: string) {
    const client = new Client({ name: "http-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: teamganttToken
        ? { headers: { Authorization: `Bearer ${teamganttToken}` } }
        : {},
    });
    await client.connect(transport);
    return client;
  }

  async function connectWithHeaders(url: URL, headers: Record<string, string>) {
    const client = new Client({ name: "http-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers } });
    await client.connect(transport);
    return client;
  }

  it("rejects initialization without a token when no default is configured", async () => {
    const url = await startServer(vi.fn());
    await expect(connect(url)).rejects.toThrow(/401|Unauthorized/i);
  });

  it("binds each session to the bearer token it presented", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }));
    const url = await startServer(fetchFn);

    const alice = await connect(url, "alice-token");
    const bob = await connect(url, "bob-token");
    await alice.callTool({ name: "get_project", arguments: { project_id: 1 } });
    await bob.callTool({ name: "get_project", arguments: { project_id: 2 } });

    const authHeaders = fetchFn.mock.calls.map(
      (call) => (call[1] as RequestInit).headers as Record<string, string>,
    );
    expect(authHeaders[0]!.Authorization).toBe("Bearer alice-token");
    expect(authHeaders[1]!.Authorization).toBe("Bearer bob-token");

    await alice.close();
    await bob.close();
  });

  it("falls back to the configured default token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }));
    const url = await startServer(fetchFn, { defaultToken: "env-token" });

    const client = await connect(url);
    await client.callTool({ name: "get_project", arguments: { project_id: 1 } });

    const headers = fetchFn.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer env-token");
    await client.close();
  });

  it("rejects requests without the configured API key", async () => {
    const url = await startServer(vi.fn(), { apiKey: "secret-key", defaultToken: "env-token" });
    await expect(connect(url)).rejects.toThrow(/401|Unauthorized/i);
  });

  it("accepts the API key via the X-API-Key header and uses the env token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }));
    const url = await startServer(fetchFn, { apiKey: "secret-key", defaultToken: "env-token" });

    const client = await connectWithHeaders(url, { "X-API-Key": "secret-key" });
    await client.callTool({ name: "get_project", arguments: { project_id: 1 } });

    const headers = fetchFn.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer env-token");
    await client.close();
  });

  it("accepts the API key as a bearer token without treating it as a TeamGantt token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }));
    const url = await startServer(fetchFn, { apiKey: "secret-key", defaultToken: "env-token" });

    const client = await connect(url, "secret-key");
    await client.callTool({ name: "get_project", arguments: { project_id: 1 } });

    const headers = fetchFn.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer env-token");
    await client.close();
  });

  it("keeps per-session tenant tokens when a gate key is present", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }));
    const url = await startServer(fetchFn, { apiKey: "secret-key" });

    const client = await connectWithHeaders(url, {
      "X-API-Key": "secret-key",
      Authorization: "Bearer alice-token",
    });
    await client.callTool({ name: "get_project", arguments: { project_id: 1 } });

    const headers = fetchFn.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer alice-token");
    await client.close();
  });
});

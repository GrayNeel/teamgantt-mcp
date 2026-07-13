import { describe, expect, it, vi } from "vitest";
import { TeamGanttClient } from "../src/client/teamgantt.js";
import { TeamGanttApiError } from "../src/client/errors.js";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeClient(fetchFn: typeof fetch, maxRetries = 2) {
  return new TeamGanttClient({
    token: "test-token",
    baseUrl: "https://api.example.com",
    maxRetries,
    fetchFn,
    sleepFn: async () => {},
  });
}

describe("TeamGanttClient", () => {
  it("sends the bearer token and JSON headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));
    const client = makeClient(fetchFn);

    await client.post("/v1/projects", { name: "Test" });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/v1/projects");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Test" }));
  });

  it("serializes query params, repeating array values", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = makeClient(fetchFn);

    await client.get("/v1/tasks", {
      "project_ids[]": [1, 2],
      include_completed: true,
      page: undefined,
    });

    const url = new URL(fetchFn.mock.calls[0]![0]);
    expect(url.searchParams.getAll("project_ids[]")).toEqual(["1", "2"]);
    expect(url.searchParams.get("include_completed")).toBe("true");
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("returns null for 204 responses", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = makeClient(fetchFn);

    await expect(client.delete("/v1/times/1")).resolves.toBeNull();
  });

  it("throws TeamGanttApiError with details on non-2xx", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { message: "Task not found" }));
    const client = makeClient(fetchFn);

    const error = (await client.get("/v1/tasks/999").catch((e) => e)) as TeamGanttApiError;
    expect(error).toBeInstanceOf(TeamGanttApiError);
    expect(error.status).toBe(404);
    expect(error.message).toContain("404");
    expect(error.message).toContain("Task not found");
  });

  it("retries on 429 honoring Retry-After, then succeeds", async () => {
    const sleeps: number[] = [];
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}, { "Retry-After": "1" }))
      .mockResolvedValueOnce(jsonResponse(200, { data: "ok" }));
    const client = new TeamGanttClient({
      token: "t",
      baseUrl: "https://api.example.com",
      fetchFn,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });

    await expect(client.get("/v1/projects")).resolves.toEqual({ data: "ok" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([1000]);
  });

  it("gives up after maxRetries on 5xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(503, "unavailable"));
    const client = makeClient(fetchFn, 2);

    const error = (await client.get("/v1/projects").catch((e) => e)) as TeamGanttApiError;
    expect(error).toBeInstanceOf(TeamGanttApiError);
    expect(error.status).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry non-retryable statuses", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { message: "bad" }));
    const client = makeClient(fetchFn);

    await expect(client.get("/v1/projects")).rejects.toBeInstanceOf(TeamGanttApiError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

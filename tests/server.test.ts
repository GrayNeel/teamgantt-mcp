import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TeamGanttClient } from "../src/client/teamgantt.js";
import { createServer } from "../src/server.js";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function connectedClient(fetchFn: typeof fetch) {
  const tgClient = new TeamGanttClient({
    token: "test-token",
    baseUrl: "https://api.example.com",
    fetchFn,
    sleepFn: async () => {},
    maxRetries: 0,
  });
  const server = createServer(tgClient);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("teamgantt MCP server", () => {
  it("exposes the milestone-1 tool catalog", async () => {
    const client = await connectedClient(vi.fn());
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    for (const expected of [
      "list_projects", "get_project", "get_project_children", "create_project",
      "update_project", "archive_project",
      "list_tasks", "get_task", "create_task", "create_tasks_bulk", "update_task",
      "delete_task", "add_task_dependency", "remove_task_dependency",
      "list_task_resources", "assign_task_resource", "update_task_assignment",
      "remove_task_assignment", "list_groups", "create_group",
      "get_timesheets", "set_timesheet_hours", "list_time_blocks",
      "get_todays_time_blocks", "get_active_time_block", "get_open_time_blocks",
      "create_time_block", "punch_in", "punch_out", "update_time_block",
      "delete_time_block",
      "get_group", "update_group", "delete_group",
      "list_comments", "create_comment", "update_comment", "delete_comment",
      "pin_comment", "list_discussions",
      "get_current_user", "get_company", "update_company", "list_company_users",
      "get_company_user", "invite_company_user", "update_company_user",
      "remove_company_user", "list_company_projects",
      "get_project_resource_options", "list_project_resources",
      "create_project_resource", "update_project_resource", "delete_project_resource",
      "list_company_resources", "create_company_resource", "update_company_resource",
      "delete_company_resource", "add_company_resource_to_project",
      "remove_company_resource_from_project",
      "get_user_workload", "get_unassigned_workload", "get_resource_workload",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("calls the TeamGantt API and returns trimmed JSON on success", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        total: 1,
        count: 1,
        current_page: 1,
        projects: [
          { id: 1, name: "Website", status: "Active", accesses: [], integrations: [] },
        ],
      }),
    );
    const client = await connectedClient(fetchFn);

    const result = await client.callTool({
      name: "list_projects",
      arguments: { status: "active", company_ids: [10, 20] },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const parsed = JSON.parse(text);
    expect(parsed.total).toBe(1);
    expect(parsed.projects[0]).toEqual({ id: 1, name: "Website", status: "Active" });

    const url = new URL(fetchFn.mock.calls[0]![0]);
    expect(url.pathname).toBe("/v1/projects");
    expect(url.searchParams.get("status")).toBe("active");
    expect(url.searchParams.getAll("company_ids[]")).toEqual(["10", "20"]);
  });

  it("caps list_tasks client-side when the API ignores per_page", async () => {
    const tasks = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      name: `Task ${i + 1}`,
      type: "task",
      comment_info: {},
    }));
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, tasks));
    const client = await connectedClient(fetchFn);

    const result = await client.callTool({
      name: "list_tasks",
      arguments: { per_page: 10, page: 3 },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({ total: 200, page: 3, per_page: 10, count: 10 });
    expect(parsed.tasks[0]).toEqual({ id: 21, name: "Task 21", type: "task" });
  });

  it("maps dependency inputs to the API body shape", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 55 }));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "add_task_dependency",
      arguments: { task_id: 100, to_task_id: 200, type: "SS", lead_lag_time: -1 },
    });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain("/v1/tasks/100/dependencies");
    expect(JSON.parse(init.body)).toEqual({
      to_task: { id: 200 },
      type: "SS",
      lead_lag_time: -1,
    });
  });

  it("builds the timesheet PUT path from task and date", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { hours: 4 }));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "set_timesheet_hours",
      arguments: { task_id: 42, date: "2026-07-13", hours: 4 },
    });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain("/v1/timesheets/42/2026-07-13");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ hours: 4 });
  });

  it("builds comment paths from target and target_id", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 7 }));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "create_comment",
      arguments: {
        target: "tasks",
        target_id: 42,
        message: "Done, please review",
        users_emailed: [13231984],
      },
    });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain("/v1/tasks/42/comments");
    expect(JSON.parse(init.body)).toEqual({
      message: "Done, please review",
      users_emailed: [13231984],
    });
  });

  it("maps pin_comment to the pin endpoint with a pinned body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "pin_comment",
      arguments: { target: "projects", target_id: 5, comment_id: 9, pinned: true },
    });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain("/v1/projects/5/comments/9/pin");
    expect(JSON.parse(init.body)).toEqual({ pinned: true });
  });

  it("defaults list_discussions limit to 50 and maps project filter", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "list_discussions",
      arguments: { project_ids: [1, 2], is_unread: true },
    });

    const url = new URL(fetchFn.mock.calls[0]![0]);
    expect(url.pathname).toBe("/v1/discussions");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("is_unread")).toBe("true");
    expect(url.searchParams.getAll("project_id[]")).toEqual(["1", "2"]);
  });

  it("joins workload ids into comma-separated query params", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "get_user_workload",
      arguments: {
        user_ids: [11, 22],
        project_ids: [3, 4],
        group_by: "week",
        start_date: "2026-07-14",
        end_date: "2026-07-28",
      },
    });

    const url = new URL(fetchFn.mock.calls[0]![0]);
    expect(url.pathname).toBe("/v1/workload/users");
    expect(url.searchParams.get("ids")).toBe("11,22");
    expect(url.searchParams.get("project_ids")).toBe("3,4");
    expect(url.searchParams.get("group_by")).toBe("week");
  });

  it("routes get_resource_workload by resource_type", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "get_resource_workload",
      arguments: { resource_type: "company", resource_ids: [7] },
    });

    const url = new URL(fetchFn.mock.calls[0]![0]);
    expect(url.pathname).toBe("/v1/workload/company_resources");
    expect(url.searchParams.get("ids")).toBe("7");
  });

  it("posts company user invites without the path params in the body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { data: { id: 1 } }));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "invite_company_user",
      arguments: {
        company_id: 741198,
        email_address: "new@example.com",
        permissions: "basic",
        send_invite: false,
      },
    });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain("/v1/companies/741198/users");
    expect(JSON.parse(init.body)).toEqual({
      email_address: "new@example.com",
      permissions: "basic",
      send_invite: false,
    });
  });

  it("deletes project resources via the resources/project route", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = await connectedClient(fetchFn);

    await client.callTool({
      name: "delete_project_resource",
      arguments: { project_id: 5, resource_id: 9 },
    });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain("/v1/projects/5/resources/project/9");
    expect(init.method).toBe("DELETE");
  });

  it("returns isError with an actionable message on API failure", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { message: "Project not found" }));
    const client = await connectedClient(fetchFn);

    const result = await client.callTool({
      name: "get_project",
      arguments: { project_id: 999 },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("404");
    expect(text).toContain("Project not found");
    expect(text).toContain("Hint:");
  });

  it("rejects invalid tool input before hitting the API", async () => {
    const fetchFn = vi.fn();
    const client = await connectedClient(fetchFn);

    const result = await client.callTool({
      name: "set_timesheet_hours",
      arguments: { task_id: 42, date: "13/07/2026", hours: 4 },
    });

    expect(result.isError).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

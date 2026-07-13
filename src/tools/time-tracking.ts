import * as schema from "../schemas/time.js";
import { trimTimesheets } from "./trim.js";
import { run, type ToolModule } from "./types.js";

export const registerTimeTrackingTools: ToolModule = (server, client) => {
  server.registerTool(
    "get_timesheets",
    {
      title: "Get timesheets",
      description:
        "Get the current user's timesheet: tasks grouped by project with logged hours per date. " +
        "Filter by projects and a date window.",
      inputSchema: schema.getTimesheets,
      annotations: { readOnlyHint: true },
    },
    async ({ project_ids, ...rest }) =>
      run(async () =>
        trimTimesheets(
          await client.get("/v1/timesheets", {
            ...rest,
            project_ids: project_ids?.join(","),
          }),
        ),
      ),
  );

  server.registerTool(
    "set_timesheet_hours",
    {
      title: "Set timesheet hours",
      description:
        "Set the total hours logged for a task on a specific date (overwrites the existing value for that day). " +
        "Use this for after-the-fact time logging; use punch_in/punch_out for live tracking.",
      inputSchema: schema.setTimesheetHours,
    },
    async ({ task_id, date, hours }) =>
      run(() => client.put(`/v1/timesheets/${task_id}/${date}`, { hours })),
  );

  server.registerTool(
    "list_time_blocks",
    {
      title: "List time blocks",
      description:
        "List time blocks (individual time entries with start/end) for a date, for the current user or specified users.",
      inputSchema: schema.listTimeBlocks,
      annotations: { readOnlyHint: true },
    },
    async ({ date, user_ids }) =>
      run(() => client.get("/v1/times", { date, user_ids: user_ids?.join(",") })),
  );

  server.registerTool(
    "get_todays_time_blocks",
    {
      title: "Get today's time blocks",
      description: "Get all of the current user's time blocks for today, including completed ones.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => run(() => client.get("/v1/times/today")),
  );

  server.registerTool(
    "get_active_time_block",
    {
      title: "Get active time block",
      description:
        "Get the currently running (punched-in) time block for today, if any. Use its ID with punch_out.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => run(() => client.get("/v1/times/current")),
  );

  server.registerTool(
    "get_open_time_blocks",
    {
      title: "Get open time blocks",
      description:
        "Get all unended (open) time blocks for the current user, including ones left open from previous days.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => run(() => client.get("/v1/times/open")),
  );

  server.registerTool(
    "create_time_block",
    {
      title: "Create time block",
      description:
        "Record a completed time entry on a task with explicit start and end times. " +
        "For live tracking use punch_in/punch_out instead.",
      inputSchema: schema.createTimeBlock,
    },
    async (input) => run(() => client.post("/v1/times", input)),
  );

  server.registerTool(
    "punch_in",
    {
      title: "Punch in",
      description:
        "Start tracking time on a task now (creates an open time block). End it later with punch_out.",
      inputSchema: schema.punchIn,
    },
    async ({ task_id }) => run(() => client.post("/v1/times/punch-in", { task_id })),
  );

  server.registerTool(
    "punch_out",
    {
      title: "Punch out",
      description:
        "Stop tracking time: sets the end time of an open time block. " +
        "Find the open block with get_active_time_block or get_open_time_blocks.",
      inputSchema: schema.punchOut,
    },
    async ({ time_id }) => run(() => client.post(`/v1/times/${time_id}/punch-out`)),
  );

  server.registerTool(
    "update_time_block",
    {
      title: "Update time block",
      description: "Correct a time block's start time, end time, or move it to a different task.",
      inputSchema: schema.updateTimeBlock,
    },
    async ({ time_id, ...body }) => run(() => client.patch(`/v1/times/${time_id}`, body)),
  );

  server.registerTool(
    "delete_time_block",
    {
      title: "Delete time block",
      description: "Permanently delete a time entry. Cannot be undone.",
      inputSchema: schema.deleteTimeBlock,
      annotations: { destructiveHint: true },
    },
    async ({ time_id }) => run(() => client.delete(`/v1/times/${time_id}`)),
  );
};

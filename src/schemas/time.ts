import { z } from "zod";
import { id, isoDate, isoDateTime } from "./common.js";

export const getTimesheets = {
  project_ids: z.array(id).optional().describe("Filter timesheets by project IDs"),
  start_date: isoDate.optional().describe("Start date of the timesheet window (YYYY-MM-DD)"),
  end_date: isoDate.optional().describe("End date of the timesheet window (YYYY-MM-DD)"),
  include_overdue: z.boolean().optional().describe("Include overdue tasks"),
};

export const setTimesheetHours = {
  task_id: id.describe("ID of the task to log time for"),
  date: isoDate.describe("The date to set hours for (YYYY-MM-DD)"),
  hours: z.number().min(0).max(24).describe("Total hours to record for that task on that date"),
};

export const listTimeBlocks = {
  date: isoDate.optional().describe("Get time blocks for a specific date (YYYY-MM-DD)"),
  user_ids: z
    .array(id)
    .optional()
    .describe("User IDs to get time blocks for (defaults to the current user)"),
};

export const createTimeBlock = {
  task_id: id.describe("ID of the task to log time against"),
  start_time: isoDateTime.describe("Start of the time block (ISO 8601)"),
  end_time: isoDateTime.describe("End of the time block (ISO 8601)"),
  user_id: id
    .optional()
    .describe("Create the time block for another user (requires project admin)"),
};

export const punchIn = {
  task_id: id.describe("ID of the task to start tracking time on"),
};

export const punchOut = {
  time_id: id.describe("ID of the open time block to punch out of (see get_active_time_block or get_open_time_blocks)"),
};

export const updateTimeBlock = {
  time_id: id.describe("ID of the time block to update"),
  task_id: id.optional().describe("Move the time block to a different task"),
  start_time: isoDateTime.optional().describe("Updated start time (ISO 8601)"),
  end_time: isoDateTime.optional().describe("Updated end time (ISO 8601)"),
};

export const deleteTimeBlock = {
  time_id: id.describe("ID of the time block to delete (cannot be undone)"),
};

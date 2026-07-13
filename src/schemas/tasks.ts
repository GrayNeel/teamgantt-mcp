import { z } from "zod";
import { id, isoDate, page, perPage } from "./common.js";

export const taskColor = z.enum([
  "blue1", "blue2", "blue3", "brown1", "green1", "green2", "green3", "grey1",
  "magenta1", "milestone", "orange1", "orange2", "pink1", "purple1", "purple2",
  "red1", "yellow1",
]);

export const taskType = z
  .enum(["task", "milestone"])
  .describe("Type of task. Milestones must have matching start_date and end_date");

const taskFields = {
  name: z.string().min(1).max(255).describe("Name/title of the task"),
  start_date: isoDate.optional().describe("Start date of the task (YYYY-MM-DD)"),
  end_date: isoDate.optional().describe("End date of the task (YYYY-MM-DD)"),
  percent_complete: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Completion percentage (0-100)"),
  type: taskType.optional(),
  color: taskColor.optional().describe("Color identifier for the task in the UI"),
  estimated_hours: z.number().min(0).optional().describe("Estimated hours to complete the task"),
};

export const listTasks = {
  project_ids: z.array(id).optional().describe("Filter tasks by project IDs"),
  start_date: isoDate.optional().describe("Only tasks starting on or after this date"),
  end_date: isoDate.optional().describe("Only tasks ending on or before this date"),
  include_completed: z.boolean().optional().describe("Include completed tasks (default false)"),
  page,
  per_page: perPage,
};

export const getTask = {
  task_id: id.describe("Unique identifier of the task"),
};

export const createTask = {
  project_id: id.describe("ID of the project where the task will be created"),
  parent_group_id: id.describe(
    "ID of the group that will contain this task. Use list_groups or get_project_children to find group IDs, or create_group to make one",
  ),
  ...taskFields,
};

const bulkTaskItem = z.object({
  project_id: id.describe("ID of the project (must match the top-level project_id)"),
  parent_group_id: id.describe("ID of the group that will contain this task"),
  name: taskFields.name,
  start_date: taskFields.start_date,
  end_date: taskFields.end_date,
  percent_complete: taskFields.percent_complete,
  type: taskFields.type,
  color: taskFields.color,
  estimated_hours: taskFields.estimated_hours,
});

export const createTasksBulk = {
  project_id: id.describe("ID of the project where all tasks will be created"),
  tasks: z
    .array(bulkTaskItem)
    .min(1)
    .max(100)
    .describe("Tasks to create (1-100, all in the same project)"),
};

export const updateTask = {
  task_id: id.describe("Unique identifier of the task to update"),
  name: taskFields.name.optional(),
  start_date: taskFields.start_date,
  end_date: taskFields.end_date,
  percent_complete: taskFields.percent_complete,
  type: taskFields.type,
  color: taskFields.color,
  estimated_hours: taskFields.estimated_hours,
  parent_group_id: id.optional().describe("Move the task to a different parent group"),
};

export const deleteTask = {
  task_id: id.describe("Unique identifier of the task to delete (cannot be undone)"),
};

export const addTaskDependency = {
  task_id: id.describe("ID of the dependent task (the one that waits)"),
  to_task_id: id.describe("ID of the task it depends on (the predecessor)"),
  type: z
    .enum(["FS", "SS", "FF", "SF"])
    .optional()
    .describe(
      "Dependency type: FS Finish-to-Start (default), SS Start-to-Start, FF Finish-to-Finish, SF Start-to-Finish",
    ),
  lead_lag_time: z
    .number()
    .int()
    .optional()
    .describe("Lead or lag time in days (positive = lag, negative = lead)"),
};

export const removeTaskDependency = {
  task_id: id.describe("ID of the task the dependency belongs to"),
  dependency_id: id.describe("ID of the dependency to delete"),
};

export const listTaskResources = {
  task_id: id.describe("Unique identifier of the task"),
  type: z
    .enum(["user", "team", "company_resource"])
    .optional()
    .describe("Filter assigned resources by type"),
};

export const assignTaskResource = {
  task_id: id.describe("ID of the task to assign the resource to"),
  type: z
    .enum(["user", "company", "project"])
    .describe("Type of resource being assigned"),
  type_id: id.describe("ID of the user, company resource, or project resource"),
  hours_per_day: z
    .number()
    .min(0)
    .max(24)
    .optional()
    .describe("Hours per day to allocate this resource"),
  total_hours: z.number().min(0).optional().describe("Total hours to allocate"),
};

export const updateTaskAssignment = {
  task_id: id.describe("ID of the task"),
  resource_id: id.describe("ID of the resource assignment to update"),
  hours_per_day: z.number().min(0).max(24).optional().describe("Updated hours per day"),
  total_hours: z.number().min(0).optional().describe("Updated total hours"),
};

export const removeTaskAssignment = {
  task_id: id.describe("ID of the task"),
  resource_id: id.describe("ID of the resource assignment to remove"),
};

export const listGroups = {
  project_id: id.describe("Project to list groups for"),
  flatten_children: z
    .boolean()
    .optional()
    .describe("Flatten nested subgroups into a single list"),
};

export const createGroup = {
  project_id: id.describe("ID of the project this group belongs to"),
  name: z.string().min(1).max(255).describe("Name of the group"),
  parent_group_id: id
    .optional()
    .describe("ID of the parent group (omit for a root-level group)"),
};

export const getGroup = {
  group_id: id.describe("Unique identifier of the group"),
};

export const updateGroup = {
  group_id: id.describe("Unique identifier of the group to update"),
  name: z.string().min(1).max(255).optional().describe("Updated group name"),
  parent_group_id: id
    .optional()
    .describe("Move the group under a different parent group"),
  sort: z.number().int().optional().describe("Updated sort order"),
};

export const deleteGroup = {
  group_id: id.describe(
    "Unique identifier of the group to delete (deletes its tasks too — cannot be undone)",
  ),
};

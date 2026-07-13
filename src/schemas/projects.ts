import { z } from "zod";
import { id, isoDate, page, perPage } from "./common.js";

export const projectStatus = z.enum(["active", "on hold", "complete"]);

export const listProjects = {
  status: z
    .enum(["active", "on hold", "complete", "other"])
    .optional()
    .describe("Filter by project status (default: active)"),
  q: z.string().optional().describe("Search query to filter project names"),
  is_template: z.boolean().optional().describe("Filter by template status"),
  company_ids: z.array(id).optional().describe("Filter by specific company IDs"),
  page,
  limit: perPage,
};

export const getProject = {
  project_id: id.describe("Unique identifier of the project"),
};

export const createProject = {
  company_id: id.describe("ID of the company to create the project in"),
  name: z.string().min(1).max(255).describe("Name of the project"),
  start_date: isoDate.optional().describe("Project start date (defaults to today)"),
  template: id.optional().describe("ID of a template project to copy from"),
  chart_days: z
    .array(z.number().int().min(1).max(7))
    .optional()
    .describe("Working days of the week (1=Monday .. 7=Sunday). Defaults to [1,2,3,4,5]"),
  default_view: z
    .enum(["gantt", "list", "board", "calendar", "discussions"])
    .optional()
    .describe("Default view for the project (defaults to gantt)"),
  is_template: z.boolean().optional().describe("Whether this project is a template"),
  has_hours_enabled: z.boolean().optional().describe("Whether hour tracking is enabled"),
};

export const updateProject = {
  project_id: id.describe("Unique identifier of the project to update"),
  name: z.string().min(1).max(255).optional().describe("Updated project name"),
  status: projectStatus.optional().describe("Updated project status"),
  default_view: z
    .enum(["gantt", "list", "board", "calendar", "discussions"])
    .optional()
    .describe("Updated default view"),
  has_hours_enabled: z.boolean().optional().describe("Updated hour-tracking setting"),
  chart_days: z
    .array(z.number().int().min(1).max(7))
    .optional()
    .describe("Updated working days (1=Monday .. 7=Sunday)"),
  is_starred: z.boolean().optional().describe("Star/unstar the project for the current user"),
};

export const archiveProject = {
  project_id: id.describe("Unique identifier of the project to archive"),
};

export const getProjectChildren = {
  project_id: id.describe("Unique identifier of the project"),
  is_flat_list: z
    .boolean()
    .optional()
    .describe("Return children as a flat list instead of a nested tree"),
};

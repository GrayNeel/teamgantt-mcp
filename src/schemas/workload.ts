import { z } from "zod";
import { id, isoDate } from "./common.js";

const windowFields = {
  group_by: z
    .enum(["day", "week", "month"])
    .optional()
    .describe("How to group workload data (default day)"),
  start_date: isoDate.optional().describe("Start date for the workload window (YYYY-MM-DD)"),
  end_date: isoDate.optional().describe("End date for the workload window (YYYY-MM-DD)"),
};

export const getUserWorkload = {
  user_ids: z
    .array(id)
    .min(1)
    .describe("User IDs to get workload for (see list_company_users / get_current_user)"),
  project_ids: z.array(id).optional().describe("Filter to specific projects"),
  ...windowFields,
};

export const getUnassignedWorkload = {
  project_ids: z.array(id).optional().describe("Filter to specific projects"),
  ...windowFields,
};

export const getResourceWorkload = {
  resource_type: z
    .enum(["company", "project"])
    .describe("Whether the ids are company resources or project-specific resources"),
  resource_ids: z.array(id).min(1).describe("Resource IDs to get workload for"),
  project_id: id.optional().describe("Filter to a single project"),
  ...windowFields,
};

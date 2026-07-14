import { z } from "zod";
import { id } from "./common.js";

export const getProjectHealth = {
  project_ids: z
    .array(id)
    .min(1)
    .describe("Project IDs to generate health reports for (see list_projects)"),
};

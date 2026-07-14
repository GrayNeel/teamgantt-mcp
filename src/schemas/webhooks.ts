import { z } from "zod";
import { id } from "./common.js";

export const listWebhooks = {};

export const createWebhook = {
  target_id: id.describe("ID of the project to monitor"),
  events: z
    .array(z.string())
    .min(1)
    .describe(
      "Event types to subscribe to. Known events: task_created, task_updated, task_deleted",
    ),
  url: z.string().url().describe("Endpoint URL that will receive webhook POST requests"),
};

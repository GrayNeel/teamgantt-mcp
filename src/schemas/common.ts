import { z } from "zod";

export const id = z.number().int().positive();

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .describe("Date in YYYY-MM-DD format");

export const isoDateTime = z
  .string()
  .describe("Timestamp in ISO 8601 format, e.g. 2024-01-15T10:30:00Z");

export const page = z
  .number()
  .int()
  .min(1)
  .optional()
  .describe("Page number for pagination (starts at 1)");

export const perPage = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe("Results per page (1-100)");

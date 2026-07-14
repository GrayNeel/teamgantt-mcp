import { z } from "zod";
import { id } from "./common.js";

export const companyId = id.describe("ID of the company (see get_current_user)");

export const companyPermissions = z
  .enum(["basic", "edit", "manager", "account_holder", "guest", "collaborator"])
  .describe("Company-level permission level");

export const getCurrentUser = {};

export const getCompany = {
  company_id: companyId,
};

export const updateCompany = {
  company_id: companyId,
  name: z.string().min(1).describe("Updated company name"),
};

export const listCompanyUsers = {
  company_id: companyId,
};

export const getCompanyUser = {
  company_id: companyId,
  user_id: id.describe("ID of the user"),
};

export const inviteCompanyUser = {
  company_id: companyId,
  email_address: z.string().email().describe("Email address of the user to invite"),
  permissions: companyPermissions.describe(
    "Permission level to grant (basic/edit/manager/account_holder/guest/collaborator)",
  ),
  first_name: z.string().optional().describe("First name of the user"),
  last_name: z.string().optional().describe("Last name of the user"),
  name: z.string().optional().describe("Full name (alternative to first_name/last_name)"),
  send_invite: z.boolean().optional().describe("Whether to send an invitation email"),
};

export const updateCompanyUser = {
  company_id: companyId,
  user_id: id.describe("ID of the user to update"),
  first_name: z.string().optional().describe("Updated first name (pending users only)"),
  last_name: z.string().optional().describe("Updated last name (pending users only)"),
  email_address: z.string().email().optional().describe("Updated email (pending users only)"),
  permissions: companyPermissions.optional().describe("Updated permission level"),
  is_disabled: z.boolean().optional().describe("Whether to disable the user"),
};

export const removeCompanyUser = {
  company_id: companyId,
  user_id: id.describe("ID of the user to remove from the company"),
};

export const listCompanyProjects = {
  company_id: companyId,
};

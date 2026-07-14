import { z } from "zod";
import { id } from "./common.js";
import { companyId } from "./people.js";

const projectId = id.describe("ID of the project");
const resourceId = id.describe("ID of the resource");

/** Resource colors are TeamGantt color names, e.g. "blue2" — same palette as task colors. */
const color = z.string().describe("Color identifier for the resource, e.g. 'blue2'");

export const getProjectResourceOptions = {
  project_id: projectId,
};

export const listProjectResources = {
  project_id: projectId,
};

export const createProjectResource = {
  project_id: projectId,
  name: z.string().min(1).describe("Name of the resource"),
  color: color.optional(),
};

export const updateProjectResource = {
  project_id: projectId,
  resource_id: resourceId,
  name: z.string().min(1).describe("Updated name of the resource"),
};

export const deleteProjectResource = {
  project_id: projectId,
  resource_id: resourceId,
};

export const listCompanyResources = {
  company_id: companyId,
};

export const createCompanyResource = {
  company_id: companyId,
  name: z.string().min(1).describe("Name of the resource"),
};

export const updateCompanyResource = {
  company_id: companyId,
  resource_id: resourceId,
  name: z.string().min(1).describe("Updated name of the resource"),
};

export const deleteCompanyResource = {
  company_id: companyId,
  resource_id: resourceId,
};

export const addCompanyResourceToProject = {
  project_id: projectId,
  company_resource_id: id.describe("ID of the company resource to add to the project"),
  color: color.describe("Color for this resource in the project context, e.g. 'blue2'"),
};

export const removeCompanyResourceFromProject = {
  project_id: projectId,
  company_resource_option_id: id.describe(
    "ID of the project↔company-resource link (the id returned by add_company_resource_to_project, " +
      "not the company resource id)",
  ),
};

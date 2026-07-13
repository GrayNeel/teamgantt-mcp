/**
 * Response trimming for list/tree tools.
 *
 * Real TeamGantt responses are enormous — a single task is ~17 KB of JSON and
 * a project tree can exceed 4 MB — so list tools return compact summaries.
 * Detail tools (get_project, get_task) still return the full payload.
 */

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(obj: Dict, keys: readonly string[]): Dict {
  const out: Dict = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

const PROJECT_KEYS = [
  "id", "name", "status", "type", "company_id", "start_date", "end_date",
  "is_template", "has_hours_enabled", "permission", "default_view",
] as const;

export function trimProject(project: unknown): unknown {
  return isDict(project) ? pick(project, PROJECT_KEYS) : project;
}

/** Envelope of GET /v1/projects: {total, count, current_page, projects: [...]} */
export function trimProjectList(response: unknown): unknown {
  if (!isDict(response) || !Array.isArray(response.projects)) return response;
  return { ...response, projects: response.projects.map(trimProject) };
}

const RESOURCE_KEYS = [
  "id", "type", "type_id", "name", "hours_per_day", "total_hours",
] as const;

export function trimResource(resource: unknown): unknown {
  return isDict(resource) ? pick(resource, RESOURCE_KEYS) : resource;
}

const DEPENDENCY_KEYS = [
  "id", "type", "lead_lag_time", "from_task_id", "to_task_id",
] as const;

function trimDependency(dep: unknown): unknown {
  if (!isDict(dep)) return dep;
  const out = pick(dep, DEPENDENCY_KEYS);
  if (isDict(dep.from_task)) out.from_task_name = dep.from_task.name;
  if (isDict(dep.to_task)) out.to_task_name = dep.to_task.name;
  return out;
}

/** Task dependencies come as {parents: [...], children: [...]}. */
function trimDependencies(deps: unknown): unknown {
  if (!isDict(deps)) return deps;
  const out: Dict = {};
  if (Array.isArray(deps.parents) && deps.parents.length > 0) {
    out.parents = deps.parents.map(trimDependency);
  }
  if (Array.isArray(deps.children) && deps.children.length > 0) {
    out.children = deps.children.map(trimDependency);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const TASK_KEYS = [
  "id", "name", "type", "project_id", "project_name", "parent_group_id",
  "parent_group_name", "start_date", "end_date", "percent_complete",
  "estimated_hours", "actual_hours", "estimate", "is_critical", "wbs", "color",
] as const;

export function trimTask(task: unknown): unknown {
  if (!isDict(task)) return task;
  const out = pick(task, TASK_KEYS);
  if (Array.isArray(task.resources) && task.resources.length > 0) {
    out.resources = task.resources.map(trimResource);
  }
  const deps = trimDependencies(task.dependencies);
  if (deps !== undefined) out.dependencies = deps;
  return out;
}

const GROUP_KEYS = [
  "id", "name", "type", "project_id", "parent_group_id", "start_date", "end_date", "sort",
] as const;

const TASK_LITE_KEYS = [
  "id", "name", "type", "start_date", "end_date", "percent_complete",
] as const;

/**
 * Summarize a project-children / groups tree.
 *
 * Trees on real projects can contain thousands of embedded full task objects
 * (observed: 4.8 MB for one project), so by default tasks are collapsed into a
 * per-group `task_count` and the result is a groups-only skeleton — enough to
 * pick a parent_group_id. With includeTasks, tasks appear as minimal tuples;
 * full task browsing belongs to the paginated list_tasks tool.
 */
export function summarizeTree(nodes: unknown, includeTasks = false): unknown {
  if (!Array.isArray(nodes)) return nodes;
  const result: unknown[] = [];
  for (const node of nodes) {
    if (!isDict(node)) continue;
    if (node.type === "group") {
      const out = pick(node, GROUP_KEYS);
      const children = Array.isArray(node.children) ? node.children : [];
      const taskCount = children.filter((c) => isDict(c) && c.type !== "group").length;
      if (taskCount > 0) out.task_count = taskCount;
      const summarized = summarizeTree(children, includeTasks) as unknown[];
      if (summarized.length > 0) out.children = summarized;
      result.push(out);
    } else if (includeTasks) {
      result.push(pick(node, TASK_LITE_KEYS));
    }
  }
  return result;
}

/** Timesheet entries embed the full ~17 KB task object — reduce it to a reference. */
export function trimTimesheetEntry(entry: unknown): unknown {
  if (!isDict(entry)) return entry;
  const out: Dict = { ...entry };
  if (isDict(entry.task)) {
    out.task = pick(entry.task, ["id", "name", "project_id", "project_name"]);
  }
  return out;
}

export function trimTimesheets(response: unknown): unknown {
  return Array.isArray(response) ? response.map(trimTimesheetEntry) : response;
}

export interface PageResult {
  total: number;
  page: number;
  per_page: number;
  count: number;
  items: unknown[];
}

/**
 * Client-side pagination guard: the live API has been observed ignoring
 * per_page on GET /v1/tasks and returning every task (thousands). Slice
 * defensively so a single tool call can never flood the context window.
 */
export function paginate(items: unknown[], page = 1, perPage = 50): PageResult {
  const start = (page - 1) * perPage;
  const slice = items.slice(start, start + perPage);
  return {
    total: items.length,
    page,
    per_page: perPage,
    count: slice.length,
    items: slice,
  };
}

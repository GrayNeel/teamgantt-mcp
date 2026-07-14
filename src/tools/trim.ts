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

/** Reduce a full user object (email, timezone, notification settings…) to id + name. */
function trimUser(user: unknown): unknown {
  if (!isDict(user)) return user;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return { id: user.id, ...(name ? { name } : {}) };
}

const COMMENT_KEYS = [
  "id", "message", "type", "target", "target_id", "target_name", "project_id",
  "added_date", "updated_at", "pin_date", "is_read", "attached_documents",
] as const;

export function trimComment(comment: unknown): unknown {
  if (!isDict(comment)) return comment;
  const out = pick(comment, COMMENT_KEYS);
  if (comment.added_by !== undefined) out.added_by = trimUser(comment.added_by);
  return out;
}

export function trimComments(response: unknown): unknown {
  return Array.isArray(response) ? response.map(trimComment) : response;
}

const DISCUSSION_KEYS = [
  "target", "target_id", "target_name", "project_id", "project_name",
  "message_preview", "last_comment_date", "is_unread", "is_mentioned",
  "has_unread_mention", "is_my_task", "is_note", "is_starred",
] as const;

/** Envelope of GET /v1/discussions: {unread_count, unread_mention_count, discussions: [...]} */
export function trimDiscussions(response: unknown): unknown {
  if (!isDict(response) || !Array.isArray(response.discussions)) return response;
  return {
    ...response,
    discussions: response.discussions.map((item) => {
      if (!isDict(item)) return item;
      const out = pick(item, DISCUSSION_KEYS);
      if (Array.isArray(item.commenters)) out.commenters = item.commenters.map(trimUser);
      return out;
    }),
  };
}

/** Single-group detail: keep group fields but summarize embedded children (can be >100 KB raw). */
export function trimGroupDetail(group: unknown): unknown {
  if (!isDict(group)) return group;
  const out = pick(group, [...GROUP_KEYS, "project_name", "parent_group_name"]);
  if (Array.isArray(group.children)) {
    const taskCount = group.children.filter((c) => isDict(c) && c.type !== "group").length;
    if (taskCount > 0) out.task_count = taskCount;
    out.children = summarizeTree(group.children, true);
  }
  return out;
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

const COMPANY_SUMMARY_KEYS = [
  "id", "name", "current_user_permissions", "plan_name",
  "is_time_tracking_enabled", "is_time_estimating_enabled",
] as const;

const CURRENT_USER_KEYS = [
  "id", "email_address", "first_name", "last_name", "time_zone",
  "today_date", "status", "created_at",
] as const;

/**
 * GET /v1/current_user is ~5 KB: the companies array embeds full company
 * objects (plan, limits, subscriptions) and the rest is preference blobs.
 * Keep the profile plus a per-company summary — enough to discover the
 * user id and company id that other tools need.
 */
export function trimCurrentUser(user: unknown): unknown {
  if (!isDict(user)) return user;
  const out = pick(user, CURRENT_USER_KEYS);
  if (Array.isArray(user.companies)) {
    out.companies = user.companies.map((c) =>
      isDict(c) ? pick(c, COMPANY_SUMMARY_KEYS) : c,
    );
  }
  return out;
}

const COMPANY_USER_KEYS = [
  "id", "email_address", "first_name", "last_name", "permissions",
  "status", "is_disabled", "can_invite",
] as const;

/** GET /v1/companies/{id}/users returns a bare array; drop pic URLs and timestamps. */
export function trimCompanyUsers(response: unknown): unknown {
  const users = Array.isArray(response)
    ? response
    : isDict(response) && Array.isArray(response.data)
      ? response.data
      : null;
  if (!users) return response;
  return users.map((u) => (isDict(u) ? pick(u, COMPANY_USER_KEYS) : u));
}

/** GET /v1/companies/{id}/projects — same project summaries as list_projects. */
export function trimCompanyProjects(response: unknown): unknown {
  if (Array.isArray(response)) return response.map(trimProject);
  if (isDict(response) && Array.isArray(response.data)) {
    return { ...response, data: response.data.map(trimProject) };
  }
  return response;
}

/**
 * GET /v1/projects/{id}/resource_options: user_resources embed full user
 * objects — reduce them to assignment-relevant fields. Company and project
 * resources are already compact.
 */
export function trimResourceOptions(response: unknown): unknown {
  if (!isDict(response) || !Array.isArray(response.user_resources)) return response;
  return {
    ...response,
    user_resources: response.user_resources.map((u) =>
      isDict(u) ? pick(u, COMPANY_USER_KEYS) : u,
    ),
  };
}

const WORKLOAD_ENTRY_KEYS = [
  "date", "hours", "tasks_total", "hours_total", "tasks_remaining", "hours_remaining",
] as const;

function trimWorkloadSeries(series: unknown): unknown {
  if (!isDict(series)) return series;
  const out: Dict = { type: series.type, type_id: series.type_id };
  if (Array.isArray(series.data)) {
    out.data = series.data.map((entry) => {
      if (!isDict(entry)) return entry;
      const day = pick(entry, WORKLOAD_ENTRY_KEYS);
      if (Array.isArray(entry.tasks) && entry.tasks.length > 0) {
        day.tasks = entry.tasks.map((t) => (isDict(t) ? pick(t, TASK_LITE_KEYS) : t));
      }
      return day;
    });
  }
  return out;
}

/** Workload responses are per-date aggregates; embedded task lists collapse to minimal tuples. */
export function trimWorkload(response: unknown): unknown {
  return Array.isArray(response)
    ? response.map(trimWorkloadSeries)
    : trimWorkloadSeries(response);
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

import * as schema from "../schemas/tasks.js";
import { paginate, summarizeTree, trimResource, trimTask } from "./trim.js";
import { run, type ToolModule } from "./types.js";

export const registerTaskTools: ToolModule = (server, client) => {
  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List tasks visible to the current user, filterable by project and date range (compact summaries, " +
        "paginated — use get_task for full details). Completed tasks are excluded unless include_completed is true. " +
        "Check `total` in the response and request further pages if needed.",
      inputSchema: schema.listTasks,
      annotations: { readOnlyHint: true },
    },
    async ({ project_ids, page, per_page, ...rest }) =>
      run(async () => {
        const pageNum = page ?? 1;
        const perPage = per_page ?? 50;
        const response = await client.get("/v1/tasks", {
          ...rest,
          page: pageNum,
          per_page: perPage,
          "project_ids[]": project_ids,
        });
        if (!Array.isArray(response)) return response;
        const tasks = response.map(trimTask);
        if (tasks.length <= perPage) {
          // API honored pagination — this is already the requested page.
          return { page: pageNum, per_page: perPage, count: tasks.length, tasks };
        }
        // The live API has been observed ignoring per_page and returning every
        // task — slice client-side so one call can't flood the context window.
        const result = paginate(tasks, pageNum, perPage);
        return {
          total: result.total,
          page: result.page,
          per_page: result.per_page,
          count: result.count,
          tasks: result.items,
        };
      }),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description:
        "Get all details of a single task: name, dates, progress, estimates and metadata.",
      inputSchema: schema.getTask,
      annotations: { readOnlyHint: true },
    },
    async ({ task_id }) => run(() => client.get(`/v1/tasks/${task_id}`)),
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description:
        "Create a task or milestone in a project. Requires a parent_group_id — every task lives inside a group. " +
        "Use get_project_children or list_groups to find one, or create_group first on a fresh project.",
      inputSchema: schema.createTask,
    },
    async (input) => run(() => client.post("/v1/tasks", input)),
  );

  server.registerTool(
    "create_tasks_bulk",
    {
      title: "Create tasks in bulk",
      description:
        "Create up to 100 tasks in one call, all in the same project (groups may differ per task). " +
        "Prefer this over repeated create_task calls when building out a plan.",
      inputSchema: schema.createTasksBulk,
    },
    async (input) => run(() => client.post("/v1/tasks/bulk", input)),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description:
        "Update a task: rename, reschedule (start/end dates), set percent_complete, change type/color/estimates, " +
        "or move it to another group. Partial update — send only the fields to change.",
      inputSchema: schema.updateTask,
    },
    async ({ task_id, ...body }) => run(() => client.patch(`/v1/tasks/${task_id}`, body)),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description:
        "Permanently delete a task, including its comments, time tracking and assignments. Cannot be undone.",
      inputSchema: schema.deleteTask,
      annotations: { destructiveHint: true },
    },
    async ({ task_id }) => run(() => client.delete(`/v1/tasks/${task_id}`)),
  );

  server.registerTool(
    "add_task_dependency",
    {
      title: "Add task dependency",
      description:
        "Create a scheduling dependency: task_id becomes dependent on to_task_id (the predecessor). " +
        "Default type FS means the predecessor must finish before task_id starts.",
      inputSchema: schema.addTaskDependency,
    },
    async ({ task_id, to_task_id, type, lead_lag_time }) =>
      run(() =>
        client.post(`/v1/tasks/${task_id}/dependencies`, {
          to_task: { id: to_task_id },
          ...(type !== undefined ? { type } : {}),
          ...(lead_lag_time !== undefined ? { lead_lag_time } : {}),
        }),
      ),
  );

  server.registerTool(
    "remove_task_dependency",
    {
      title: "Remove task dependency",
      description:
        "Delete a dependency between two tasks so they can be scheduled independently. " +
        "The dependency ID is returned when creating it and included in task details.",
      inputSchema: schema.removeTaskDependency,
      annotations: { destructiveHint: true },
    },
    async ({ task_id, dependency_id }) =>
      run(() => client.delete(`/v1/tasks/${task_id}/dependencies/${dependency_id}`)),
  );

  server.registerTool(
    "list_task_resources",
    {
      title: "List task assignments",
      description:
        "List resources (people, teams, labels) assigned to a task, with their hour allocations.",
      inputSchema: schema.listTaskResources,
      annotations: { readOnlyHint: true },
    },
    async ({ task_id, type }) =>
      run(async () => {
        const response = await client.get(`/v1/tasks/${task_id}/resources`, { type });
        return Array.isArray(response) ? response.map(trimResource) : response;
      }),
  );

  server.registerTool(
    "assign_task_resource",
    {
      title: "Assign resource to task",
      description:
        "Assign a user or resource to a task with optional hour allocations (affects workload/capacity planning).",
      inputSchema: schema.assignTaskResource,
    },
    async ({ task_id, ...body }) =>
      run(() => client.post(`/v1/tasks/${task_id}/resources`, body)),
  );

  server.registerTool(
    "update_task_assignment",
    {
      title: "Update task assignment",
      description: "Change the hour allocation of an existing resource assignment on a task.",
      inputSchema: schema.updateTaskAssignment,
    },
    async ({ task_id, resource_id, ...body }) =>
      run(() => client.patch(`/v1/tasks/${task_id}/resources/${resource_id}`, body)),
  );

  server.registerTool(
    "remove_task_assignment",
    {
      title: "Remove task assignment",
      description:
        "Unassign a resource from a task, removing its allocation and associated time blocks.",
      inputSchema: schema.removeTaskAssignment,
      annotations: { destructiveHint: true },
    },
    async ({ task_id, resource_id }) =>
      run(() => client.delete(`/v1/tasks/${task_id}/resources/${resource_id}`)),
  );

  server.registerTool(
    "list_groups",
    {
      title: "List groups",
      description:
        "List the task groups of a project (skeleton tree with per-group task counts). Groups are the " +
        "containers tasks live in — use this to find parent_group_id values for create_task.",
      inputSchema: schema.listGroups,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, flatten_children }) =>
      run(async () =>
        summarizeTree(
          await client.get("/v1/groups", { "project_ids[]": [project_id], flatten_children }),
        ),
      ),
  );

  server.registerTool(
    "create_group",
    {
      title: "Create group",
      description:
        "Create a task group in a project (root-level, or nested under parent_group_id). " +
        "Create a group before adding tasks to a brand-new project.",
      inputSchema: schema.createGroup,
    },
    async (input) => run(() => client.post("/v1/groups", input)),
  );
};

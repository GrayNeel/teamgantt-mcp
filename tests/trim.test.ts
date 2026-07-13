import { describe, expect, it } from "vitest";
import {
  paginate,
  summarizeTree,
  trimProjectList,
  trimTask,
  trimTimesheets,
} from "../src/tools/trim.js";

// Fixtures mirror real API responses observed against the live API (July 2026).

const fullTask = {
  id: 113485408,
  name: "Configure proxy",
  type: "task",
  project_id: 2254439,
  project_name: "NE_CIAM",
  parent_group_id: 55,
  parent_group_name: "Phase 1",
  start_date: "2026-07-01",
  end_date: "2026-07-10",
  percent_complete: 40,
  estimated_hours: 16,
  actual_hours: 4,
  // noise that must be dropped:
  comment_info: { count: 0, edit_date: null, has_unread: false },
  document_info: { count: 18, edit_date: "2025-10-16" },
  checklist_info: { total: 3, done: 1 },
  slack: 2,
  work_days_left: 5,
  roj: null,
  materials: [],
  project_permission: "own_progress",
  created_by: 1,
  updated_by: 1,
  resources: [
    {
      id: 65185537,
      type: "user",
      type_id: 13231984,
      name: "Alessandro Colucci",
      hours_per_day: 0,
      total_hours: 0,
      pic: "https://api.teamgantt.com/assets/user_pic/?text=AC",
      raci_roles: null,
      schedule_confirmation: [],
    },
  ],
  dependencies: {
    parents: [
      {
        id: 27716734,
        project_id: 2254439,
        from_task_id: 115159192,
        to_task_id: 113485408,
        lead_lag_time: 0,
        type: "FS",
        from_task: { id: 115159192, name: "Receive machine", color: "blue2" },
        to_task: { id: 113485408, name: "Configure proxy" },
      },
    ],
    children: [],
  },
};

describe("trimTask", () => {
  it("keeps planning fields and drops noise", () => {
    const trimmed = trimTask(fullTask) as Record<string, unknown>;
    expect(trimmed.id).toBe(113485408);
    expect(trimmed.percent_complete).toBe(40);
    expect(trimmed.parent_group_id).toBe(55);
    for (const dropped of [
      "comment_info", "document_info", "checklist_info", "slack",
      "work_days_left", "roj", "materials", "project_permission",
    ]) {
      expect(trimmed).not.toHaveProperty(dropped);
    }
  });

  it("summarizes resources and dependencies", () => {
    const trimmed = trimTask(fullTask) as {
      resources: Array<Record<string, unknown>>;
      dependencies: { parents: Array<Record<string, unknown>>; children?: unknown };
    };
    expect(trimmed.resources[0]).toEqual({
      id: 65185537,
      type: "user",
      type_id: 13231984,
      name: "Alessandro Colucci",
      hours_per_day: 0,
      total_hours: 0,
    });
    expect(trimmed.dependencies.parents[0]).toEqual({
      id: 27716734,
      type: "FS",
      lead_lag_time: 0,
      from_task_id: 115159192,
      to_task_id: 113485408,
      from_task_name: "Receive machine",
      to_task_name: "Configure proxy",
    });
    // empty children array is omitted entirely
    expect(trimmed.dependencies).not.toHaveProperty("children");
  });
});

describe("summarizeTree", () => {
  const tree = [
    {
      id: 1,
      name: "Phase 1",
      type: "group",
      project_id: 2254439,
      parent_group_id: null,
      start_date: "2026-07-01",
      end_date: "2026-07-31",
      comment_info: {},
      document_info: {},
      days: 22,
      children: [fullTask, { id: 2, name: "Sub", type: "group", children: [] }],
    },
  ];

  it("collapses tasks into task_count by default (groups-only skeleton)", () => {
    const [group] = summarizeTree(tree) as Array<Record<string, unknown>>;
    expect(group!.name).toBe("Phase 1");
    expect(group!.task_count).toBe(1);
    expect(group).not.toHaveProperty("comment_info");
    const children = group!.children as Array<Record<string, unknown>>;
    // only the subgroup remains — the task is collapsed into task_count
    expect(children).toHaveLength(1);
    expect(children[0]!.type).toBe("group");
  });

  it("includes minimal task entries when includeTasks is set", () => {
    const [group] = summarizeTree(tree, true) as Array<Record<string, unknown>>;
    const children = group!.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(2);
    expect(children[0]).toEqual({
      id: 113485408,
      name: "Configure proxy",
      type: "task",
      start_date: "2026-07-01",
      end_date: "2026-07-10",
      percent_complete: 40,
    });
    expect(children[1]!.type).toBe("group");
  });
});

describe("trimProjectList", () => {
  it("trims project items but keeps the envelope", () => {
    const response = {
      total: 1,
      count: 1,
      current_page: 1,
      projects: [
        {
          id: 2254439,
          name: "NE_CIAM",
          status: "Active",
          company_id: 741198,
          is_template: false,
          has_hours_enabled: true,
          permission: "own_progress",
          // noise:
          comment_info: {}, document_info: {}, integrations: [], teams: [],
          accesses: [], preferences: {}, boards: [], public_key: "x",
        },
      ],
    };
    const trimmed = trimProjectList(response) as {
      total: number;
      projects: Array<Record<string, unknown>>;
    };
    expect(trimmed.total).toBe(1);
    expect(trimmed.projects[0]!.name).toBe("NE_CIAM");
    expect(trimmed.projects[0]).not.toHaveProperty("accesses");
    expect(trimmed.projects[0]).not.toHaveProperty("integrations");
  });
});

describe("trimTimesheets", () => {
  it("reduces the embedded task object to a reference", () => {
    const trimmed = trimTimesheets([
      { task_id: 42, user_id: 7, times: [], task: { ...fullTask, id: 42 } },
    ]) as Array<{ task: Record<string, unknown> }>;
    expect(trimmed[0]!.task).toEqual({
      id: 42,
      name: "Configure proxy",
      project_id: 2254439,
      project_name: "NE_CIAM",
    });
  });
});

describe("paginate", () => {
  it("slices and reports totals", () => {
    const items = Array.from({ length: 130 }, (_, i) => i);
    const result = paginate(items, 2, 50);
    expect(result).toMatchObject({ total: 130, page: 2, per_page: 50, count: 50 });
    expect(result.items[0]).toBe(50);
  });
});

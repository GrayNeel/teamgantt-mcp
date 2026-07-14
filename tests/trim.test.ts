import { describe, expect, it } from "vitest";
import {
  paginate,
  summarizeTree,
  trimComments,
  trimCompanyProjects,
  trimCompanyUsers,
  trimCurrentUser,
  trimDiscussions,
  trimGroupDetail,
  trimProjectList,
  trimResourceOptions,
  trimTask,
  trimTimesheets,
  trimWorkload,
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

const fullUser = {
  id: 13254063,
  email_address: "someone@example.com",
  first_name: "Jane",
  last_name: "Doe",
  daily_email_hour: null,
  time_zone: "+02:00",
  created_at: "2021-08-01",
  status: "active",
  pic: "https://api.teamgantt.com/assets/user_pic/?text=JD",
  email_notification_settings: { everything: true },
};

describe("trimComments", () => {
  it("keeps message fields and reduces added_by to id + name", () => {
    const trimmed = trimComments([
      {
        id: 900,
        message: "Looks good",
        type: "comment",
        target: "tasks",
        target_id: 42,
        target_name: "Test task",
        project_id: 1,
        added_date: "2026-07-14T10:00:00Z",
        added_by: fullUser,
        // noise:
        app: "web",
        reactions: [],
        user: fullUser,
        users_emailed: [],
        is_read: true,
      },
    ]) as Array<Record<string, unknown>>;
    expect(trimmed[0]!.message).toBe("Looks good");
    expect(trimmed[0]!.added_by).toEqual({ id: 13254063, name: "Jane Doe" });
    expect(trimmed[0]).not.toHaveProperty("reactions");
    expect(trimmed[0]).not.toHaveProperty("user");
  });
});

describe("trimDiscussions", () => {
  it("keeps the unread envelope and reduces commenters to id + name", () => {
    const trimmed = trimDiscussions({
      unread_count: 41,
      unread_mention_count: 0,
      discussions: [
        {
          target: "tasks",
          target_id: 42,
          target_name: "Test task",
          project_id: 1,
          project_name: "P",
          message_preview: "Looks good",
          last_comment_date: "2026-07-14T10:00:00Z",
          is_unread: true,
          commenters: [fullUser],
          has_documents: false,
        },
      ],
    }) as { unread_count: number; discussions: Array<Record<string, unknown>> };
    expect(trimmed.unread_count).toBe(41);
    expect(trimmed.discussions[0]!.commenters).toEqual([{ id: 13254063, name: "Jane Doe" }]);
    expect(trimmed.discussions[0]!.message_preview).toBe("Looks good");
    expect(trimmed.discussions[0]).not.toHaveProperty("has_documents");
  });
});

describe("trimGroupDetail", () => {
  it("keeps group fields and summarizes embedded task children", () => {
    const trimmed = trimGroupDetail({
      id: 24237897,
      name: "Phase 1",
      type: "group",
      project_id: 1,
      project_name: "P",
      parent_group_id: null,
      comment_info: {},
      document_info: {},
      children: [fullTask],
    }) as Record<string, unknown>;
    expect(trimmed.name).toBe("Phase 1");
    expect(trimmed.task_count).toBe(1);
    expect(trimmed).not.toHaveProperty("comment_info");
    const children = trimmed.children as Array<Record<string, unknown>>;
    expect(children[0]).toEqual({
      id: 113485408,
      name: "Configure proxy",
      type: "task",
      start_date: "2026-07-01",
      end_date: "2026-07-10",
      percent_complete: 40,
    });
  });
});

// Mirrors the real GET /v1/current_user (July 2026): companies embed the full
// company object; preference/notification blobs dominate the payload.
const fullCompany = {
  id: 741198,
  name: "Acme",
  current_user_permissions: "account_holder",
  plan_name: "Advanced",
  is_time_tracking_enabled: true,
  is_time_estimating_enabled: true,
  // noise:
  account_holders: [fullUser], features: ["a", "b"], plan: { limitations: {} },
  subscriptions: [{ customer_id: "cus_x" }], addons: [], sso: null,
  billing_above: "x", city: "Rome", storage_used: "1GB",
};

describe("trimCurrentUser", () => {
  it("keeps the profile and reduces companies to summaries", () => {
    const trimmed = trimCurrentUser({
      id: 13254063,
      email_address: "someone@example.com",
      first_name: "Jane",
      last_name: "Doe",
      time_zone: "+02:00",
      status: "active",
      created_at: "2021-08-01",
      companies: [fullCompany],
      // noise:
      preferences: { gantt: {} }, preferences_new: {}, notifications: {},
      mobile_notifications: {}, integrations: [], integrationsNew: {},
      welcome_survey: null, email_notification_settings: {}, pic: "https://x",
    }) as Record<string, unknown>;
    expect(trimmed.id).toBe(13254063);
    expect(trimmed.email_address).toBe("someone@example.com");
    expect(trimmed.companies).toEqual([
      {
        id: 741198,
        name: "Acme",
        current_user_permissions: "account_holder",
        plan_name: "Advanced",
        is_time_tracking_enabled: true,
        is_time_estimating_enabled: true,
      },
    ]);
    for (const dropped of ["preferences", "notifications", "integrations", "pic"]) {
      expect(trimmed).not.toHaveProperty(dropped);
    }
  });
});

describe("trimCompanyUsers", () => {
  it("keeps permission fields and drops pic/timestamps", () => {
    const trimmed = trimCompanyUsers([
      {
        id: 13231984,
        email_address: "ac@example.com",
        first_name: "Alessandro",
        last_name: "Colucci",
        permissions: "basic",
        status: "active",
        is_disabled: false,
        can_invite: true,
        created_at: "2021-07-15T10:54:29Z",
        pic: "https://api.teamgantt.com/assets/user_pic/?text=AC",
      },
    ]) as Array<Record<string, unknown>>;
    expect(trimmed[0]).toEqual({
      id: 13231984,
      email_address: "ac@example.com",
      first_name: "Alessandro",
      last_name: "Colucci",
      permissions: "basic",
      status: "active",
      is_disabled: false,
      can_invite: true,
    });
  });

  it("unwraps a data envelope if present", () => {
    const trimmed = trimCompanyUsers({ data: [{ id: 1, pic: "x" }] }) as Array<
      Record<string, unknown>
    >;
    expect(trimmed).toEqual([{ id: 1 }]);
  });
});

describe("trimCompanyProjects", () => {
  it("applies project summaries inside the data envelope", () => {
    const trimmed = trimCompanyProjects({
      data: [{ id: 2254439, name: "NE_CIAM", status: "Active", accesses: [], boards: [] }],
    }) as { data: Array<Record<string, unknown>> };
    expect(trimmed.data[0]).toEqual({ id: 2254439, name: "NE_CIAM", status: "Active" });
  });
});

describe("trimResourceOptions", () => {
  it("reduces user_resources and passes other resource types through", () => {
    const trimmed = trimResourceOptions({
      user_resources: [{ ...fullUser, permissions: "basic" }],
      company_resources: [{ id: 3, company_id: 741198, name: "Crane" }],
      project_resources: [{ id: 4, project_id: 1, name: "Rig", color: "blue2" }],
    }) as Record<string, Array<Record<string, unknown>>>;
    expect(trimmed.user_resources![0]).toEqual({
      id: 13254063,
      email_address: "someone@example.com",
      first_name: "Jane",
      last_name: "Doe",
      permissions: "basic",
      status: "active",
    });
    expect(trimmed.company_resources![0]!.name).toBe("Crane");
    expect(trimmed.project_resources![0]!.color).toBe("blue2");
  });
});

describe("trimWorkload", () => {
  // Real per-date entries (July 2026): tasks_total/hours_total/…_remaining.
  const series = {
    type: "user",
    type_id: 13254063,
    data: [
      {
        date: "2026-07-14",
        tasks_total: 13,
        hours_total: 7.24,
        tasks_remaining: 13,
        hours_remaining: 7.24,
        tasks: [fullTask],
      },
    ],
  };

  it("keeps per-date aggregates and collapses embedded tasks", () => {
    const [trimmed] = trimWorkload([series]) as Array<{
      type: string;
      data: Array<Record<string, unknown>>;
    }>;
    expect(trimmed!.type).toBe("user");
    expect(trimmed!.data[0]).toMatchObject({ date: "2026-07-14", hours_total: 7.24 });
    expect(trimmed!.data[0]!.tasks).toEqual([
      {
        id: 113485408,
        name: "Configure proxy",
        type: "task",
        start_date: "2026-07-01",
        end_date: "2026-07-10",
        percent_complete: 40,
      },
    ]);
  });

  it("handles the single-object shape of /workload/unassigned", () => {
    const trimmed = trimWorkload({
      type: "unassigned",
      type_id: "",
      data: [{ date: "2026-07-13", tasks_total: 1, hours_total: 4, extraneous: {} }],
    }) as { type: string; data: Array<Record<string, unknown>> };
    expect(trimmed.type).toBe("unassigned");
    expect(trimmed.data[0]).toEqual({ date: "2026-07-13", tasks_total: 1, hours_total: 4 });
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

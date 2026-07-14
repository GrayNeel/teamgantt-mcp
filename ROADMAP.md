# Roadmap

This document tracks the milestone plan for the TeamGantt MCP server. Each milestone is one
or more API domains added through the mechanical recipe described in
[CLAUDE.md](CLAUDE.md#adding-a-new-api-domain): one Zod schema file, one tool module, one
registry line, plus response trimmers and tests. Endpoint paths below reference TeamGantt's
[OpenAPI spec](https://api-docs.teamgantt.com) so each milestone has a concrete scope.

Ordering after M4 reflects rough value-to-effort, not a commitment — priorities can shift.

## Shipped

| Milestone | Scope | Version |
|---|---|---|
| **M1** | Projects, Groups (list/create), Tasks + dependencies + assignments, Time tracking | `v0.1.0` |
| **M1.5** | Response trimming, client-side pagination guard | `v0.2.0` |
| **M2** | Comments/notes on tasks/groups/projects, discussions inbox, group get/update/delete | `v0.3.0` |
| **M3** | People (`current_user`, companies, company users), project/company resources, workload/availability | `v0.4.0` |
| **M4** | Reports (project health), webhooks, `teamgantt://` MCP resources, multi-tenant HTTP auth | `v0.5.0` |

## Planned

### M5 — Task detail & content

Everything that hangs off a single task beyond scheduling — the pieces needed to actually
*work* a task, not just plan it.

- Checklist items — `GET/POST /v1/tasks/{taskId}/checklist_items`, `PATCH/DELETE /v1/tasks/{taskId}/checklist_items/{id}`
- Documents & attachments — `GET/POST /v1/tasks/{taskId}/documents`, `PATCH/DELETE /v1/tasks/{taskId}/documents/{id}`, `POST /v1/tasks/{taskId}/documents/mark_read`
- Links — `GET /v1/tasks/{taskId}/links`
- History / audit trail — `GET /v1/task/{taskId}/history`, `GET /v1/groups/{groupId}/history`
- Task operations — `POST /v1/tasks/{taskId}/duplicate`, `POST /v1/tasks/{taskId}/convert_to_subgroup`, `POST /v1/tasks/{taskId}/request-progress`

**Why:** highest everyday value — checklists and documents are how work items get executed.
**Watch for:** document upload is multipart, not JSON — the shared client currently only sends
`application/json`, so this milestone likely extends the client to handle file bodies (or scopes
uploads out initially and exposes read/list/metadata first).

### M6 — Planning & analysis

Advanced scheduling views that turn the raw plan into decisions.

- Critical path — `GET /v1/projects/{projectId}/critical_path`
- Baselines — `GET/POST /v1/projects/{projectId}/baselines`
- RACI roles — `GET/PUT /v1/projects/{projectId}/raci_roles`
- Board health report — `GET /v1/reports/health/board` (complements the shipped project health)

**Why:** these are the analytical endpoints that make the server useful for PMs, not just editors.
**Watch for:** critical-path and baseline responses are large — they need trimmers sampled against
a real project (per the trimming rule in CLAUDE.md).

### M7 — Sharing & access control

Managing who can see and touch a project.

- Project accesses — `GET/POST /v1/projects/{projectId}/accesses`, `PATCH/DELETE /v1/projects/{projectId}/accesses/{id}`, `PATCH …/resend_invite`
- Project teams — `POST /v1/projects/{projectId}/teams`, `GET/POST /v1/companies/{companyId}/teams`
- Pending invitations — `POST /v1/projects/accept_pending_invitations`

**Why:** rounds out the people story from M3 with the permission side.
**Watch for:** these are write-heavy and permission-sensitive — annotate destructive hints
carefully and verify against a disposable test project, never a live one.

### M8 — Boards (Kanban)

TeamGantt's board view as a first-class surface.

- Boards — `GET/POST /v1/boards`, `GET/POST /v1/projects/{projectId}/boards`
- Columns — `POST /v1/columns`
- Cards — `POST /v1/cards`, `GET /v1/tasks/{taskId}/cards`

**Why:** a distinct product surface many teams use instead of the Gantt view.
**Watch for:** board IDs are UUIDs (strings), unlike the integer IDs everywhere else — schemas and
the `id` helper need a string variant.

### M9 — Company configuration & templates

Admin-level setup that shapes every project in a company.

- Holidays — `GET/POST /v1/companies/{companyId}/holidays`, `DELETE …/{holidayId}`
- Note templates — `GET/POST /v1/companies/{companyId}/note-templates`, `PATCH/DELETE …/{id}`
- Folders — `GET/POST /v1/companies/{companyId}/folders`
- Project templates — `GET /v1/templates`, `GET /v1/templates/groups`
- Bookmarks — `GET/POST /v1/bookmarks`, `GET/PATCH/DELETE /v1/bookmarks/{bookmarkId}`

**Why:** low complexity, mostly simple CRUD — a good batch to ship together.

### M10 — Custom fields

User-defined metadata on tasks, groups, and projects.

- Values — `GET /v1/custom-fields-values`, `GET/… /v1/{targetType}/{targetId}/custom-fields-values`
- Per-field values — `/v1/{targetType}/{targetId}/custom-fields/{customFieldId}/values`

**Why:** frequently requested, but the endpoints are the least documented in the spec (several
have empty method sets) — this milestone starts by sampling live responses to pin down the real
request/response shapes before writing schemas.

## Under consideration

Larger or more niche domains, deferred until there's a clear need:

- **Client portal** (~17 endpoints) — external client threads, messages, attachments, invitations,
  and portal settings. A whole product area; likely its own multi-part effort.
- **Procurement** — procurement boards, cards, and `POST /v1/costs`. Only relevant to teams using
  TeamGantt's procurement add-on.
- **Subcontractors** — company/project subcontractor management (spec methods currently undocumented).
- **CSV import/export** — `POST /v1/projects/export/csv`, `POST /v1/projects/import/csv`.
- **Schedule confirmations** — `POST /v1/schedule-confirmations/send`, `PATCH …/{id}`.

## How milestones get built

See [CLAUDE.md](CLAUDE.md) for the full workflow. In short, per milestone:

1. Extract exact request/response schemas from the embedded OpenAPI spec.
2. Sample real responses (a token is required) to confirm live behavior and size trimmers.
3. Add schema file + tool module + registry line; add trimmers for any list/tree response.
4. Add catalog and call-shape tests; run the full gate (typecheck, lint, test, build).
5. Bump the version in `package.json` and `SERVER_VERSION`, update this file and the README.

# teamgantt-mcp

An MCP (Model Context Protocol) server for the [TeamGantt API](https://api-docs.teamgantt.com), giving AI assistants full project-planning and time-management capabilities: create and schedule projects, build task plans with dependencies, assign people, and track time.

- **Transports:** stdio (default) and Streamable HTTP
- **Runtime:** Node.js ≥ 20
- **Milestone 1 scope:** Projects · Groups · Tasks (incl. dependencies & assignments) · Time tracking

## Setup

```bash
npm install
npm run build
```

Create a TeamGantt personal access token at <https://app.teamgantt.com/admin/developers/tokens> and export it:

```bash
export TEAMGANTT_API_TOKEN=your-token   # or copy .env.example to .env and use node --env-file=.env
```

### Run (stdio — for local MCP clients)

```bash
node dist/index.js
```

### Run (Streamable HTTP)

```bash
node dist/index.js --http --port 3000
# MCP endpoint: http://127.0.0.1:3000/mcp   Health: http://127.0.0.1:3000/healthz
```

The HTTP transport binds to 127.0.0.1 with DNS-rebinding protection. Extra allowed `Host` values can be added via `MCP_ALLOWED_HOSTS=host1,host2`.

## Client configuration

### Claude Code

```bash
claude mcp add teamgantt -e TEAMGANTT_API_TOKEN=your-token -- node /path/to/teamgantt-mcp/dist/index.js
```

### Claude Desktop / Cursor / other stdio clients

```json
{
  "mcpServers": {
    "teamgantt": {
      "command": "node",
      "args": ["/path/to/teamgantt-mcp/dist/index.js"],
      "env": { "TEAMGANTT_API_TOKEN": "your-token" }
    }
  }
}
```

### MCP Inspector (manual testing)

```bash
TEAMGANTT_API_TOKEN=your-token npx @modelcontextprotocol/inspector node dist/index.js
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TEAMGANTT_API_TOKEN` | ✅ | — | TeamGantt personal access token |
| `TEAMGANTT_BASE_URL` | — | `https://api.teamgantt.com` | API origin override |
| `PORT` | — | `3000` | HTTP transport port (or `--port`) |
| `MCP_ALLOWED_HOSTS` | — | — | Extra allowed Host headers for HTTP transport |
| `LOG_LEVEL` | — | `info` | `error` \| `warn` \| `info` \| `debug` |

## Tools

### Projects
| Tool | Description |
|---|---|
| `list_projects` | List projects (status filter, search, pagination) |
| `get_project` | Full project details |
| `get_project_children` | Tree of groups and tasks inside a project |
| `create_project` | Create a project (optionally from a template) |
| `update_project` | Update name/status/settings |
| `archive_project` | Archive (soft-delete) a project |

### Tasks & groups
| Tool | Description |
|---|---|
| `list_tasks` | List tasks, filterable by project and date range |
| `get_task` | Single task details |
| `create_task` | Create a task or milestone (requires a `parent_group_id`) |
| `create_tasks_bulk` | Create up to 100 tasks in one call |
| `update_task` | Rename, reschedule, set progress, move between groups |
| `delete_task` | Permanently delete a task |
| `add_task_dependency` / `remove_task_dependency` | Manage FS/SS/FF/SF dependencies with lead/lag |
| `list_task_resources` / `assign_task_resource` / `update_task_assignment` / `remove_task_assignment` | Manage who works on a task and hour allocations |
| `list_groups` / `create_group` | Manage the groups that contain tasks |

### Time tracking
| Tool | Description |
|---|---|
| `get_timesheets` | Timesheet view: hours per task per date |
| `set_timesheet_hours` | Set logged hours for a task on a date |
| `list_time_blocks` / `get_todays_time_blocks` / `get_open_time_blocks` | Inspect time entries |
| `get_active_time_block` | The currently running (punched-in) block |
| `create_time_block` | Record a completed time entry |
| `punch_in` / `punch_out` | Live time tracking |
| `update_time_block` / `delete_time_block` | Correct or remove entries |

## Architecture

```
src/
├── index.ts          CLI entry (--stdio default | --http [--port])
├── server.ts         Builds the McpServer and registers all tool modules
├── config.ts         Env parsing and validation
├── client/           Thin TeamGantt HTTP client (auth, retries, typed errors)
├── schemas/          Zod input schemas per API domain
├── tools/            One self-contained tool module per API domain
└── transports/       stdio and Streamable HTTP (session-based) transports
```

**Adding a new API domain** (e.g. Comments) is mechanical:

1. Add `src/schemas/comments.ts` with the Zod input shapes.
2. Add `src/tools/comments.ts` exporting a `ToolModule` that calls `server.registerTool(...)` for each endpoint.
3. Add the module to `TOOL_MODULES` in `src/server.ts`.

Cross-cutting behavior (bearer auth, `429`/`5xx` retry with `Retry-After`, error mapping to `isError` tool results with actionable hints) lives in the shared client and `tools/types.ts` — tool modules stay declarative.

**Response trimming** (`src/tools/trim.ts`): raw TeamGantt responses are enormous — a single task is ~17 KB and a project tree can exceed 4 MB. List tools return compact summaries (measured against a real 2 370-task project: task list 4.7 MB → ~16 KB per page, project tree 4.8 MB → ~19 KB), tree tools return a groups-only skeleton with per-group task counts, and `list_tasks` enforces pagination client-side because the live API has been observed ignoring `per_page`. Detail tools (`get_project`, `get_task`) return the full payload.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest (unit + in-memory MCP integration tests)
npm run build       # tsup → dist/
```

## Roadmap

- **M2:** Groups deep-dive + Comments (discussions, pinning)
- **M3:** Companies/Resources + Boards (kanban)
- **M4:** Reports, Bookmarks, Webhooks, Custom fields/RACI; MCP resources (`teamgantt://...`); multi-tenant HTTP auth

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP (Model Context Protocol) server for the TeamGantt API. TypeScript, ESM, Node ≥ 20, built on `@modelcontextprotocol/sdk` 1.x (stable — do not migrate to the 2.x beta without asking). Milestone 1 covers Projects, Groups, Tasks (dependencies + assignments) and Time Tracking; the roadmap in README.md lists M2–M4 domains still to be added.

## Commands

```bash
npm run build       # tsup → dist/index.js (single ESM bundle with shebang)
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm run lint        # eslint src tests
npm test            # vitest run (all tests)
npx vitest run tests/server.test.ts             # single file
npx vitest run -t "retries on 429"              # single test by name
```

Run locally: `TEAMGANTT_API_TOKEN=... node dist/index.js` (stdio, default) or `node dist/index.js --http --port 3000` (Streamable HTTP at `/mcp`, health at `/healthz`). Manual testing: `npx @modelcontextprotocol/inspector node dist/index.js`.

CI (`.gitlab-ci.yml`) runs typecheck + lint + test, then build. All four must pass before pushing.

## Architecture

The design goal is that **adding a new TeamGantt API domain is mechanical**: one schema file + one tool module + one registry line. Everything cross-cutting lives in two places:

- `src/client/teamgantt.ts` — the only HTTP code. Bearer auth, query serialization (array params are repeated with the literal `[]` key, e.g. `project_ids[]`), 429/5xx retry with `Retry-After`, 204→null, and non-2xx → `TeamGanttApiError` (`src/client/errors.ts`). `fetchFn`/`sleepFn` are constructor-injectable for tests.
- `src/tools/types.ts` — `ToolModule` type plus the `run()` wrapper every tool handler uses: it converts thrown `TeamGanttApiError`s into `isError: true` tool results with status-specific hints. Tool handlers must never let an API error escape as an exception.
- `src/tools/trim.ts` — response trimming. Real responses are huge (a task is ~17 KB; one real project tree measured 4.8 MB), so **every list/tree tool must trim**: list tools return per-domain summaries, tree tools a groups-only skeleton with `task_count`, and `list_tasks` paginates client-side because the live API ignores `per_page` (verified — it returned all 2 370 tasks). Detail tools (`get_project`, `get_task`) stay full. When adding a domain, sample the real response first and add a trimmer + fixture test in `tests/trim.test.ts`.

The flow: `src/index.ts` (CLI arg parsing) → `src/config.ts` (env validation, fails fast without `TEAMGANTT_API_TOKEN`) → `src/server.ts` (`createServer()` iterates `TOOL_MODULES`) → `src/transports/{stdio,http}.ts`. The HTTP transport is stateful (session map keyed by `Mcp-Session-Id`, one `McpServer` instance per session via the `createServer` factory) with DNS-rebinding protection; stdio logging must go to **stderr only** — stdout is the protocol channel.

### Adding a new API domain (e.g. Comments for M2)

1. `src/schemas/<domain>.ts` — Zod **raw shapes** (plain objects of validators, not `z.object()`; that's what SDK 1.x `registerTool` expects), with `.describe()` on every field.
2. `src/tools/<domain>.ts` — export a `ToolModule` that calls `server.registerTool(name, {title, description, inputSchema, annotations}, handler)` per endpoint; every handler body is `run(() => client.<method>(...))`. Use `annotations: {readOnlyHint: true}` for GETs and `{destructiveHint: true}` for deletes.
3. Append the module to `TOOL_MODULES` in `src/server.ts` and add a tool-catalog test entry in `tests/server.test.ts`.

### TeamGantt API source of truth

The docs site (https://api-docs.teamgantt.com) embeds the **complete OpenAPI 3.0 spec** in its HTML as `const __redoc_state = {...}` (`state.spec.data`, 165 paths) — there is no public `/openapi.json`, and web fetchers truncate the page. To get exact request schemas for new domains: `curl` the page, brace-match the object after the marker, `JSON.parse`. Existing tool schemas were derived this way — keep new ones field-for-field faithful to the spec rather than guessing.

Non-obvious API semantics already baked into the tools:

- Tasks **require `parent_group_id`** — tasks live inside groups. That's why `list_groups` / `create_group` / `get_project_children` exist; keep tool descriptions steering models through empty-project → create_group → create_task.
- Timesheet hours: `PUT /v1/timesheets/{taskId}/{YYYY-MM-DD}` (the task ID doubles as the "timesheet ID").
- Punch-in is `POST /v1/times/punch-in` with `task_id` in the body; punch-out is `POST /v1/times/{timeId}/punch-out` (time-block ID, not task ID).
- Dependencies: body is `{to_task: {id}, type, lead_lag_time}` where `to_task` is the predecessor of the path task.
- Dates are `YYYY-MM-DD`; time-block times are ISO 8601 datetimes.

## Testing conventions

`tests/client.test.ts` unit-tests the HTTP client with a mocked `fetchFn`. `tests/server.test.ts` is the integration path: it wires the real `McpServer` to a real MCP `Client` over `InMemoryTransport.createLinkedPair()` and asserts on the outgoing fetch calls — new tools should get at least a catalog-listing entry and, for any input→body/path mapping that isn't a passthrough, a call-shape test. Tests never hit the network.

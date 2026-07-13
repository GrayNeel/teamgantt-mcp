/** Error thrown when the TeamGantt API returns a non-2xx response. */
export class TeamGanttApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  /** Parsed error body from the API, if any. */
  readonly body: unknown;

  constructor(options: {
    status: number;
    method: string;
    path: string;
    body: unknown;
  }) {
    super(formatMessage(options));
    this.name = "TeamGanttApiError";
    this.status = options.status;
    this.method = options.method;
    this.path = options.path;
    this.body = options.body;
  }
}

function formatMessage(o: {
  status: number;
  method: string;
  path: string;
  body: unknown;
}): string {
  const detail = extractDetail(o.body);
  return `TeamGantt API error ${o.status} on ${o.method} ${o.path}${detail ? `: ${detail}` : ""}`;
}

function extractDetail(body: unknown): string | undefined {
  if (typeof body === "string" && body.trim()) return body.slice(0, 500);
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const key of ["message", "error", "errors", "detail"]) {
      const v = b[key];
      if (typeof v === "string" && v.trim()) return v;
      if (v && typeof v === "object") return JSON.stringify(v).slice(0, 500);
    }
    return JSON.stringify(body).slice(0, 500);
  }
  return undefined;
}

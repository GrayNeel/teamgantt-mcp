import { TeamGanttApiError } from "./errors.js";

export type QueryValue = string | number | boolean | Array<string | number> | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export interface TeamGanttClientOptions {
  token: string;
  /** API origin without trailing slash, e.g. https://api.teamgantt.com */
  baseUrl?: string;
  /** Retries on 429/5xx. Default 2. */
  maxRetries?: number;
  /** Injectable for tests. */
  fetchFn?: typeof fetch;
  /** Injectable for tests — sleep between retries. */
  sleepFn?: (ms: number) => Promise<void>;
}

const RETRYABLE_STATUS = (s: number) => s === 429 || s >= 500;

export class TeamGanttClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(options: TeamGanttClientOptions) {
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? "https://api.teamgantt.com").replace(/\/+$/, "");
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleepFn = options.sleepFn ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get<T = unknown>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }

  delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);

    for (let attempt = 0; ; attempt++) {
      const response = await this.fetchFn(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });

      if (response.ok) {
        if (response.status === 204) return null as T;
        const text = await response.text();
        if (!text) return null as T;
        return JSON.parse(text) as T;
      }

      if (RETRYABLE_STATUS(response.status) && attempt < this.maxRetries) {
        await this.sleepFn(retryDelayMs(response, attempt));
        continue;
      }

      throw new TeamGanttApiError({
        status: response.status,
        method,
        path,
        body: await parseErrorBody(response),
      });
    }
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const url = new URL(this.baseUrl + (path.startsWith("/") ? path : `/${path}`));
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const item of value) url.searchParams.append(key, String(item));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  }
  return 500 * 2 ** attempt;
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

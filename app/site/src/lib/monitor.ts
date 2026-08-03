/**
 * Client for the Task Monitor, which reads from either of two sources.
 *
 * Snapshot (default): `public/data/monitor.json`, written by
 * `scripts/build_monitor_snapshot.py`. A finished run has nothing left to poll,
 * so the page needs no daemon to show it.
 *
 * Live: `/api/*` on `app/server.py`, needed only while a run is in flight. The
 * Python service is the only thing that can talk to the fleet (it shells out to
 * the `aws` CLI and caches trial records on disk); `next.config.ts` rewrites
 * `/api/*` onto it, which is why every path here is relative.
 *
 * Both sources return the same shapes, so the panels are source-agnostic.
 */

export interface QueueCounts {
  visible?: number;
  in_flight?: number;
  dlq?: number;
}

export interface WorkerCounts {
  running?: number;
  total?: number;
  ssm_online?: number;
}

export interface RecordCounts {
  total?: number;
  rate_limit?: number;
  credits?: number;
  cost_usd?: number;
  passed?: number;
  failed?: number;
  error?: number;
  expected?: number;
}

export interface Overview {
  run_id?: string;
  ts?: number;
  queue?: QueueCounts;
  workers?: WorkerCounts;
  records?: RecordCounts;
  stale?: Record<string, boolean>;
  updated_at?: Record<string, number>;
}

export interface WorkerInstance {
  id: string;
  type: string;
  az: string;
  state: string;
  ssm: string;
  launched: string;
}

export interface WorkersResponse {
  workers?: WorkerInstance[];
  error?: string | null;
}

export interface KeyRow {
  key: string;
  email: string;
  accountType: string;
  plan: string;
  creditsUsed: string;
  planAllowance: string;
  nextReset: string;
  overages: string;
  overageCredits: string;
  estimatedCost: string;
  status: string;
}

export interface KeysResponse {
  keys?: KeyRow[];
  error?: string | null;
}

/** The four buckets every summary and every task row is counted into. */
export type TrialStatus = "passed" | "failed" | "error" | "missing";

export type StatusCounts = Partial<Record<TrialStatus, number>>;

export interface BenchmarksResponse {
  benchmarks?: Record<string, Record<string, StatusCounts>>;
  models?: string[];
  error?: string | null;
}

export interface TaskCell {
  model: string;
  attempt: number;
  status: TrialStatus;
  error_kind: string | null;
}

export interface TaskRow {
  task: string;
  counts: StatusCounts;
  complete: boolean;
  cells: TaskCell[];
}

export interface TasksResponse {
  benchmark?: string;
  tasks?: TaskRow[];
  error?: string | null;
}

/** One frozen run: the five API payloads plus when they were collected. */
export interface MonitorSnapshot {
  generated_at: string;
  run_id: string;
  overview: Overview;
  workers: WorkersResponse;
  keys: KeysResponse;
  benchmarks: BenchmarksResponse;
  /** `/api/tasks` responses, keyed by benchmark id. */
  tasks: Record<string, TasksResponse>;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} (${path})`);
  }
  return res.json() as Promise<T>;
}

export const getSnapshot = () =>
  fetchJSON<MonitorSnapshot>("/data/monitor.json");

export const getOverview = () => fetchJSON<Overview>("/api/overview");
export const getWorkers = () => fetchJSON<WorkersResponse>("/api/workers");
export const getKeys = () => fetchJSON<KeysResponse>("/api/keys");
export const getBenchmarks = () =>
  fetchJSON<BenchmarksResponse>("/api/benchmarks");
export const getTasks = (benchmark: string) =>
  fetchJSON<TasksResponse>(
    `/api/tasks?benchmark=${encodeURIComponent(benchmark)}`,
  );

/* -------------------------------------------------------------------------- */
/*                                 formatting                                 */
/* -------------------------------------------------------------------------- */

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "-";
  return Number(n).toLocaleString("en-US");
}

export function fmtDecimal(n: number | null | undefined): string {
  if (n == null) return "-";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function fmtClock(d: Date | null): string {
  if (!d) return "-";
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/** `null` for anything unparseable, so callers can fall back to the raw value. */
export function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "-" || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Same, for the API's pre-formatted `"$1,234.56"` cost strings. */
export function costToNum(v: string | null | undefined): number | null {
  if (v == null || v === "-" || v === "") return null;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/* -------------------------------------------------------------------------- */
/*                               status palette                               */
/* -------------------------------------------------------------------------- */

/**
 * Trial status colours, drawn from the AA design tokens in `globals.css` rather
 * than the dark dashboard's own greens/reds, so the page reads as one site.
 */
export const STATUS_BG: Record<TrialStatus, string> = {
  passed: "bg-brand-green-dark",
  failed: "bg-destructive",
  error: "bg-brand-orange",
  missing: "bg-neutral-200",
};

/** `error` never counts as a result — it is a trial that has to be requeued. */
export const STATUS_LABEL: Record<TrialStatus, string> = {
  passed: "passed",
  failed: "failed",
  error: "needs rerun",
  missing: "missing",
};

export const COUNT_LABEL: Record<TrialStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  error: "Errors",
  missing: "Missing",
};

export const COUNT_ORDER: TrialStatus[] = [
  "passed",
  "failed",
  "error",
  "missing",
];

"use client";

/**
 * `/monitor` — the Task Monitor, replacing the Vite dashboard that used to be
 * served from `app/server.py` on :8081. Same panels, same five payloads; only
 * the styling, the copy and the data source changed.
 *
 * Two sources, same shapes (see `lib/monitor.ts`). **Snapshot** is the default:
 * a finished run has a drained queue, a torn-down fleet and settled records, so
 * there is nothing to poll and the static `monitor.json` is the whole truth.
 * **Live** polls `/api/*` and is only useful while a run is in flight — it needs
 * `app/server.py` up.
 *
 * Client-only by necessity: both sources are fetched, and the derived clocks
 * would not survive prerendering. Fetch failures keep the last good payload on
 * screen and surface a banner instead of blanking the page — during a run this
 * view is the only window into the fleet.
 */

import * as React from "react";

import { BackToTop } from "@/components/back-to-top";
import { BenchmarkPanel } from "@/components/monitor/benchmark-panel";
import { KeysTable } from "@/components/monitor/keys-table";
import { OverviewCards } from "@/components/monitor/overview-cards";
import { CONTROL_CLASS } from "@/components/monitor/panel";
import { RunSpecifications } from "@/components/monitor/run-specifications";
import { WorkersTable } from "@/components/monitor/workers-table";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import {
  fmtClock,
  getBenchmarks,
  getKeys,
  getOverview,
  getSnapshot,
  getTasks,
  getWorkers,
  type BenchmarksResponse,
  type KeysResponse,
  type Overview,
  type TasksResponse,
  type WorkersResponse,
} from "@/lib/monitor";

/** `null` = paused. Matches the dashboard this replaces, including the default. */
const INTERVALS: { label: string; ms: number | null }[] = [
  { label: "5s", ms: 5000 },
  { label: "15s", ms: 15000 },
  { label: "30s", ms: 30000 },
  { label: "60s", ms: 60000 },
  { label: "Paused", ms: null },
];

const DEFAULT_INTERVAL_MS = 15000;

type Source = "snapshot" | "live";

/** The snapshot's UTC `generated_at`, rendered in the reader's own timezone. */
function fmtSnapshotTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function MonitorPage() {
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [workers, setWorkers] = React.useState<WorkersResponse | null>(null);
  const [keys, setKeys] = React.useState<KeysResponse | null>(null);
  const [benchmarks, setBenchmarks] = React.useState<BenchmarksResponse | null>(
    null,
  );
  const [tasks, setTasks] = React.useState<TasksResponse | null>(null);
  const [activeBenchmark, setActiveBenchmark] =
    React.useState("terminal-bench-2");
  const [source, setSource] = React.useState<Source>("snapshot");
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [intervalMs, setIntervalMs] = React.useState<number | null>(
    DEFAULT_INTERVAL_MS,
  );
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      if (source === "snapshot") {
        const snap = await getSnapshot();
        setOverview(snap.overview);
        setWorkers(snap.workers);
        setKeys(snap.keys);
        setBenchmarks(snap.benchmarks);
        setTasks(snap.tasks[activeBenchmark] ?? null);
        setGeneratedAt(snap.generated_at);
      } else {
        const [o, w, k, b, t] = await Promise.all([
          getOverview(),
          getWorkers(),
          getKeys(),
          getBenchmarks(),
          getTasks(activeBenchmark),
        ]);
        setOverview(o);
        setWorkers(w);
        setKeys(k);
        setBenchmarks(b);
        setTasks(t);
        setGeneratedAt(null);
      }
      setLastUpdated(new Date());
      setFetchError(null);
    } catch (err) {
      // Deliberately keep the previous payloads rendered.
      setFetchError(err instanceof Error ? err.message : String(err));
    }
  }, [source, activeBenchmark]);

  // Polling only makes sense against the live API; the snapshot never changes
  // until the build script runs again.
  React.useEffect(() => {
    void refresh();
    if (source !== "live" || intervalMs == null) return;
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [refresh, source, intervalMs]);

  return (
    <main className="min-h-screen">
      <SiteNav />

      <div className="pb-40">
        <section className="bg-brand-blue-light pt-32 pb-10">
          <div className="container">
            <h1 className="text-4xl mb-4 max-w-[36ch] lg:max-w-[40ch]">
              Kiro CLI Benchmark Task Monitor
            </h1>
            <p className="text-sm max-w-[72ch]">
              State of the AWS worker fleet running the benchmark suite: queue
              depth, instance health, per-key credit consumption and the task ×
              model × attempt status matrix. Snapshot reads a frozen record of a
              completed run; switch to Live to poll the orchestration service on
              port 8081 while a run is in flight.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="rounded-md bg-background px-2 py-1 font-mono text-xs">
                {overview?.run_id ?? "-"}
              </span>
              <label className="flex items-center gap-2 text-xs text-neutral-600">
                Source
                <select
                  className={CONTROL_CLASS}
                  value={source}
                  onChange={(e) => setSource(e.target.value as Source)}
                >
                  <option value="snapshot">Snapshot (static)</option>
                  <option value="live">Live (API)</option>
                </select>
              </label>
              {source === "live" && (
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  Refresh every
                  <select
                    className={CONTROL_CLASS}
                    value={String(intervalMs)}
                    onChange={(e) =>
                      setIntervalMs(
                        e.target.value === "null"
                          ? null
                          : Number(e.target.value),
                      )
                    }
                  >
                    {INTERVALS.map(({ label, ms }) => (
                      <option key={label} value={String(ms)}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className={CONTROL_CLASS}
                onClick={() => void refresh()}
              >
                Refresh now
              </button>
              <span className="text-xs text-neutral-500">
                {source === "snapshot"
                  ? `Collected ${fmtSnapshotTime(generatedAt)}`
                  : `Last updated ${fmtClock(lastUpdated)}`}
              </span>
            </div>

            {fetchError && (
              <div className="mt-4 rounded-md border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-xs text-neutral-700">
                Request failed: {fetchError}
              </div>
            )}
          </div>
        </section>

        <div className="container mt-10 flex flex-col gap-8">
          <OverviewCards overview={overview} />
          <RunSpecifications />
          <KeysTable data={keys} />
          <WorkersTable data={workers} />
          <BenchmarkPanel
            benchmarks={benchmarks}
            tasks={tasks}
            activeBenchmark={activeBenchmark}
            onSelectBenchmark={setActiveBenchmark}
          />
        </div>
      </div>

      <BackToTop />
      <SiteFooter />
    </main>
  );
}

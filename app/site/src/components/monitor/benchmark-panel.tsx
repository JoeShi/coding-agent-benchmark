"use client";

/**
 * Per-benchmark view: model summary counts plus the task × model × attempt
 * matrix. Ported 1:1 from the dark dashboard's `BenchmarkPanel.jsx` — same
 * benchmark ids, same filters, same 14×14 cells, same tooltip text — restyled
 * onto the AA tokens and translated to English.
 *
 * Selecting a benchmark refetches upstream (`/api/tasks?benchmark=…`), so the
 * active id lives in the page, not here; the filter is local.
 */

import * as React from "react";

import {
  ErrorNote,
  Panel,
  TableScroll,
  TD_CLASS,
  TH_CLASS,
  TR_CLASS,
} from "@/components/monitor/panel";
import {
  COUNT_LABEL,
  COUNT_ORDER,
  STATUS_BG,
  STATUS_LABEL,
  type BenchmarksResponse,
  type TasksResponse,
} from "@/lib/monitor";

export const BENCHMARKS = [
  { id: "terminal-bench-2", label: "Terminal-Bench 2" },
  { id: "deep-swe", label: "DeepSWE" },
  { id: "swe-atlas-qna", label: "SWE-Atlas-QnA" },
] as const;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "incomplete", label: "Incomplete" },
  { id: "complete", label: "Complete" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

/** AA's "Color by" toggle group, reused for the benchmark and filter switches. */
const SEG_GROUP = "inline-flex items-center gap-1 rounded bg-brand-blue-light p-0.5";
const SEG_ITEM =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "min-w-9 h-8 rounded border border-neutral-100 px-2 text-xs shadow-none sm:px-3 " +
  "bg-transparent hover:bg-accent hover:text-accent-foreground " +
  "data-[state=on]:bg-background data-[state=on]:text-foreground";

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="group" className={SEG_GROUP}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          data-state={value === option.id ? "on" : "off"}
          onClick={() => onChange(option.id)}
          className={SEG_ITEM}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Task ids can be long (`scale-ai/swe-atlas-qna/...`); keep the tail readable. */
function shortName(name: string): string {
  if (name.length <= 48) return name;
  const slash = name.lastIndexOf("/");
  if (slash >= 0 && name.length - slash <= 44) return `\u2026${name.slice(slash)}`;
  return `${name.slice(0, 45)}\u2026`;
}

export function BenchmarkPanel({
  benchmarks,
  tasks,
  activeBenchmark,
  onSelectBenchmark,
}: {
  benchmarks: BenchmarksResponse | null;
  tasks: TasksResponse | null;
  activeBenchmark: string;
  onSelectBenchmark: (id: string) => void;
}) {
  const [filter, setFilter] = React.useState<Filter>("all");

  const summary = benchmarks?.benchmarks?.[activeBenchmark] ?? {};
  const models = Object.keys(summary);
  const taskList = tasks?.tasks ?? [];
  const filtered = taskList.filter((t) =>
    filter === "all" ? true : filter === "complete" ? t.complete : !t.complete,
  );

  return (
    <Panel
      title="Benchmarks"
      caption="One cell per trial: 6 models × 3 attempts, in enqueue order. Hover a cell for the model, attempt and error kind."
      actions={
        <Segmented
          options={BENCHMARKS}
          value={activeBenchmark as (typeof BENCHMARKS)[number]["id"]}
          onChange={onSelectBenchmark}
        />
      }
    >
      {benchmarks?.error && <ErrorNote>{benchmarks.error}</ErrorNote>}
      {tasks?.error && <ErrorNote>{tasks.error}</ErrorNote>}

      <TableScroll>
        <table className="min-w-full">
          <thead className="bg-muted">
            <tr>
              <th className={TH_CLASS}>Model</th>
              {COUNT_ORDER.map((c) => (
                <th key={c} className={TH_CLASS}>
                  {COUNT_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-background">
            {models.map((m) => (
              <tr key={m} className={TR_CLASS}>
                <td className={`${TD_CLASS} font-mono text-xs`}>{m}</td>
                {COUNT_ORDER.map((c) => (
                  <td key={c} className={TD_CLASS}>
                    {summary[m]?.[c] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        <span className="text-xs text-neutral-500">
          {filtered.length} / {taskList.length} tasks
        </span>
      </div>

      <div className="mt-3 max-h-[70vh] overflow-auto">
        <table>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.task}>
                <td
                  title={t.task}
                  className="max-w-[340px] overflow-hidden text-ellipsis whitespace-nowrap py-0.5 pr-2 font-mono text-[11px]"
                >
                  {shortName(t.task)}
                </td>
                <td className="whitespace-nowrap py-0.5">
                  {(t.cells ?? []).map((c, i) => (
                    <span
                      key={`${c.model}-${c.attempt}-${i}`}
                      title={`${c.model} attempt-${c.attempt}: ${
                        STATUS_LABEL[c.status] ?? c.status
                      }${c.error_kind ? ` (${c.error_kind})` : ""}`}
                      className={`mr-0.5 inline-block h-3.5 w-3.5 rounded-[3px] align-middle ${
                        STATUS_BG[c.status] ?? STATUS_BG.missing
                      }`}
                    />
                  ))}
                  {t.complete && (
                    <span className="ml-1.5 font-bold text-brand-green-dark">
                      ✓
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

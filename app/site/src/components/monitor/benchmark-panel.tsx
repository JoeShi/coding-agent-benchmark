"use client";

/**
 * Per-benchmark view: model summary counts plus the task × model × attempt
 * matrix. Ported 1:1 from the dark dashboard's `BenchmarkPanel.jsx` — same
 * benchmark ids, same filters, same 14×14 cells, same tooltip text — restyled
 * onto the AA tokens and translated to English. The cell tooltip is a real
 * bubble here rather than the browser's `title` popup, which needs a long hover
 * before it appears and looks nothing like the rest of the site.
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
  type TaskCell,
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

/**
 * Hover state for the matrix's single shared tooltip. A benchmark is up to
 * 124 tasks x 18 cells, so a `<Tooltip>` root per cell is far too much; cells
 * instead carry their label in `data-tip` and the grid delegates hover. Fixed
 * coordinates are viewport-relative, which keeps the bubble outside the scroll
 * container's overflow clip.
 */
type Tip = { text: string; x: number; y: number; below: boolean };

function cellLabel(c: TaskCell): string {
  const status = STATUS_LABEL[c.status] ?? c.status;
  return `${c.model} attempt-${c.attempt}: ${status}${
    c.error_kind ? ` (${c.error_kind})` : ""
  }`;
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
  const [tip, setTip] = React.useState<Tip | null>(null);

  const showTip = (e: React.MouseEvent<HTMLDivElement>) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (!cell?.dataset.tip) {
      setTip(null);
      return;
    }
    const r = cell.getBoundingClientRect();
    // Flip below when the cell sits too close to the top of the viewport to
    // fit the bubble above it (the matrix is its own scroll region).
    const below = r.top < 44;
    setTip({
      text: cell.dataset.tip,
      x: r.left + r.width / 2,
      y: below ? r.bottom + 6 : r.top - 6,
      below,
    });
  };

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

      <div
        className="mt-3 max-h-[70vh] overflow-auto"
        onMouseOver={showTip}
        onMouseLeave={() => setTip(null)}
      >
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
                  {(t.cells ?? []).map((c, i) => {
                    const label = cellLabel(c);
                    return (
                      <span
                        key={`${c.model}-${c.attempt}-${i}`}
                        data-tip={label}
                        aria-label={label}
                        className={`mr-0.5 inline-block h-3.5 w-3.5 rounded-[3px] align-middle ${
                          STATUS_BG[c.status] ?? STATUS_BG.missing
                        }`}
                      />
                    );
                  })}
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

      {tip && (
        <div
          role="tooltip"
          style={{ left: tip.x, top: tip.y }}
          className={`pointer-events-none fixed z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 font-mono text-xs text-background shadow-md ${
            tip.below ? "" : "-translate-y-full"
          }`}
        >
          {tip.text}
        </div>
      )}
    </Panel>
  );
}

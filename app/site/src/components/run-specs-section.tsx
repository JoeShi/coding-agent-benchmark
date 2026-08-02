"use client";

/**
 * Run Specifications block — see docs/research/components/run-specs-faq.spec.md §1.
 *
 * NOT a Radix accordion on the target: a plain `<button aria-expanded>` plus
 * conditionally rendered content, with `data-state="open"|"closed"` mirrored onto
 * the wrapper and the button. Closed by default.
 *
 * Computed values reproduced verbatim from the target:
 *   button  padding 8px 0 (`py-2`), margin 0 0 16px (`mb-4`),
 *           border-bottom 1px solid rgb(217,217,217) (`border-b border-border`;
 *           `--border: 0 0% 85%` → 0.85 × 255 = 216.75 ≈ 217 — a bare `border-b`
 *           would render BLACK under Tailwind v4 preflight), transparent bg,
 *           16px/24px weight 400.
 *   h2      30px/36px weight 400 serif with margin 0 — family/size come from the
 *           global `h2` rule in `globals.css` and the margin from preflight, so
 *           NO font utilities are added here.
 *   Plus    lucide, 16×16, stroke-width 2 (both lucide defaults at `size={16}`),
 *           `rotate-45` when open is what turns it into an ×.
 *   thead   height 40, `bg-muted`; th 12px/16px weight 500 rgb(120,120,120)
 *           (`--muted-foreground: 0 0% 46.9%` → 0.469 × 255 = 119.6 ≈ 120),
 *           padding 12px 12px 12px 24px (col 1) / 12px (rest).
 *   tbody   `bg-background`; rows height 54, odd transparent, even
 *           rgba(245,245,245,0.5) (`even:bg-muted/50`; `--muted: 0 0% 96.1%` →
 *           0.961 × 255 = 245.1 ≈ 245); td 14px/20px weight 500 rgb(0,0,0),
 *           padding 8px 12px 8px 24px (col 1), white-space nowrap.
 *
 * Class strings are plain concatenations — never routed through `cn()`/`twMerge`,
 * which silently drops classes the target actually ships.
 */

import * as React from "react";
import { Plus } from "lucide-react";

import { getRows } from "@/lib/leaderboard";
import type { AgentRow } from "@/types/leaderboard";

/* -------------------------------------------------------------------------- */
/*                                    Data                                    */
/* -------------------------------------------------------------------------- */

/**
 * Our rows, not AA's: `getRows("official")` sorted by `agent` then `model`, both
 * ascending — the target's order, so `Claude Code / DeepSeek V4 Pro (high)`
 * leads. 21 rows (6 Kiro + 15 AA snapshot).
 */
const ROWS: AgentRow[] = [...getRows("official")].sort(
  (a, b) => a.agent.localeCompare(b.agent) || a.model.localeCompare(b.model),
);

/**
 * Our run records no per-benchmark agent version, so this stays local to the
 * component — do not add fields to `leaderboard.ts` / `leaderboard.json`. The six
 * Kiro rows report the kiro-cli build actually used; the 15 AA-snapshot rows have
 * no version we can cite. The target itself ships `Released Unknown` for several
 * rows, so this is in-distribution.
 */
function runSpec(row: AgentRow): { version: string; released: string } {
  return row.creator === "Kiro"
    ? { version: "2.15.4", released: "Unknown" }
    : { version: "—", released: "Unknown" };
}

/** Every row in our data ran all three benchmarks. */
const COVERAGE = "3/3";

const HEADERS: string[] = [
  "Agent Name",
  "Model Name",
  "Provider",
  "Coverage",
  "DeepSWE",
  "Terminal-Bench v2",
  "SWE-Atlas-QnA",
];

/* -------------------------------------------------------------------------- */
/*                              Verbatim classes                              */
/* -------------------------------------------------------------------------- */

const TH_FIRST_CLASS =
  "p-3 text-xs font-medium text-muted-foreground pl-6 text-left";
const TH_CLASS = "p-3 text-xs font-medium text-muted-foreground text-left";

const TD_AGENT_CLASS =
  "px-3 py-2 text-sm whitespace-nowrap pl-6 text-left font-medium";
const TD_MODEL_CLASS = "px-3 py-2 text-sm whitespace-nowrap text-left";
const TD_PROVIDER_CLASS =
  "px-3 py-2 text-sm whitespace-nowrap text-left capitalize";
const TD_COVERAGE_CLASS = "px-3 py-2 text-sm whitespace-nowrap text-left";
const TD_BENCHMARK_CLASS = "px-3 py-2 text-center text-sm";

const TR_CLASS = "even:bg-muted/50 hover:bg-muted";

const TOGGLE_CLASS =
  "mb-4 flex w-full cursor-pointer items-center justify-between " +
  "border-b border-border py-2";

/* -------------------------------------------------------------------------- */
/*                              RunSpecsSection                               */
/* -------------------------------------------------------------------------- */

/** One benchmark cell: agent version above a `Released …` sub-line. */
function VersionCell({
  version,
  released,
}: {
  version: string;
  released: string;
}) {
  return (
    <div className="min-w-40 whitespace-nowrap text-left">
      <div>{version}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{`Released ${released}`}</div>
    </div>
  );
}

export function RunSpecsSection(): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const state = open ? "open" : "closed";

  return (
    <div className="mt-6" data-state={state}>
      <button
        type="button"
        aria-expanded={open}
        data-state={state}
        onClick={() => setOpen((prev) => !prev)}
        className={TOGGLE_CLASS}
      >
        <h2 id="run-specs">Run Specifications</h2>
        <Plus
          className={
            "lucide text-neutral-500 transition-transform duration-200" +
            (open ? " rotate-45" : "")
          }
          size={16}
        />
      </button>
      {open && (
        <div data-state="open">
          <div className="w-full overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-muted">
                <tr>
                  {HEADERS.map((header, i) => (
                    <th
                      key={header}
                      className={i === 0 ? TH_FIRST_CLASS : TH_CLASS}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-background">
                {ROWS.map((row) => {
                  const { version, released } = runSpec(row);
                  return (
                    <tr key={row.id} className={TR_CLASS}>
                      <td className={TD_AGENT_CLASS}>{row.agent}</td>
                      <td className={TD_MODEL_CLASS}>{row.model}</td>
                      <td className={TD_PROVIDER_CLASS}>{row.creator}</td>
                      <td className={TD_COVERAGE_CLASS}>{COVERAGE}</td>
                      <td className={TD_BENCHMARK_CLASS}>
                        <VersionCell version={version} released={released} />
                      </td>
                      <td className={TD_BENCHMARK_CLASS}>
                        <VersionCell version={version} released={released} />
                      </td>
                      <td className={TD_BENCHMARK_CLASS}>
                        <VersionCell version={version} released={released} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

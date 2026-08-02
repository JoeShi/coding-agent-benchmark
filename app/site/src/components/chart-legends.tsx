"use client";

/**
 * The two colour keys that sit above a chart, between the panel header and the
 * plot: a creator key and the scatter charts' shaded-quadrant key.
 *
 * Both are chrome rather than controls — the target's chips are `<button>`s with
 * no handler, so `type="button"` is added (React would otherwise default them to
 * submit) and nothing else. Class strings and inline styles are VERBATIM from
 * DOM inspection of the target; do not route them through `cn()`/`twMerge`.
 *
 * Measured on the `cost-distribution` tab: root `div.mt-2` (margin-top 8px,
 * height 24px), inner `div.text-sm.flex.flex-wrap.items-center` 14px/20px, one
 * chip per creator, each `flex items-center gap-1 px-1.5 py-0.5` with an
 * 8×8 `rounded-full` dot in the creator's brand colour. Nine chips spanned
 * 687px of the 1115.5px row, so our ten stay on one line and the 24px height
 * holds.
 */

import * as React from "react";

import { creatorColor } from "@/lib/leaderboard";
import type { AgentRow } from "@/types/leaderboard";

/** Distinct creators in first-appearance order — the target's chip order. */
function creatorsOf(rows: AgentRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  rows.forEach((row) => {
    if (!seen.has(row.creator)) {
      seen.add(row.creator);
      out.push(row.creator);
    }
  });
  return out;
}

/**
 * Creator colour key. Its `div.mt-2` root is what the target ships in the
 * panel's legend slot on the two distribution tabs and on `input-vs-output-tokens`,
 * and in the same position inside all three scatter-card bodies.
 */
export function CreatorLegend({ rows }: { rows: AgentRow[] }): React.ReactElement {
  return (
    <div className="mt-2">
      <div className="text-sm flex flex-wrap items-center">
        {creatorsOf(rows).map((creator) => (
          <button
            key={creator}
            type="button"
            data-state="closed"
            className="flex items-center gap-1 px-1.5 py-0.5"
            style={{ backgroundColor: "transparent" }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: creatorColor(creator) }}
            />
            <span>{creator}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Shaded-quadrant key — a single entry on the target, measured 20px tall with an
 * 8px margin-top and a 16×12 swatch.
 *
 * The inline `borderColor` overrides Tailwind v4's preflight `currentColor`
 * default, so a plain `border` is correct here (it would render BLACK without
 * the inline value).
 */
export function QuadrantLegend(): React.ReactElement {
  return (
    <div className="mt-2 ml-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <div className="flex items-center gap-2">
        <div
          className="flex-shrink-0 w-4 h-3 rounded-sm border"
          style={{
            background: "rgba(144,238,144,0.25)",
            borderColor: "rgba(144,238,144,0.4)",
          }}
        />
        <span>Most attractive quadrant</span>
      </div>
    </div>
  );
}

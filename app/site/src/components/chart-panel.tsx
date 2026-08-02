"use client";

/**
 * Tabbed-card panel body — see docs/research/components/chart-panel.spec.md §1–§2.
 *
 * All 19 tabbed cards share this exact body, so it is captured once here and
 * Phase 4 only supplies copy + which chart to embed.
 *
 * Every class string below is reproduced VERBATIM from `getComputedStyle()`/DOM
 * inspection of the target and is deliberately NOT run through `cn()`/`twMerge`
 * (a merge pass is free to drop classes the target actually ships). Plain string
 * concatenation only.
 *
 * There are NO borders anywhere in the panel body: Tailwind v4 preflight defaults
 * `border-color` to `currentColor`, so a bare `border`/`border-b` would render
 * BLACK. Do not add one.
 */

import * as React from "react";
import { Plus } from "lucide-react";

import { ChartCardHeader, MetricAccordion } from "@/components/chart-card";
import { ChartWatermark } from "@/components/icons";

/* -------------------------------------------------------------------------- */
/*                          verbatim class strings                            */
/* -------------------------------------------------------------------------- */

/**
 * Chart scroll wrapper. Note this differs from the scatter card's
 * `relative mt-2 overflow-x-scroll 2xl:overflow-visible` — the tabbed cards add
 * the `pl-4 -ml-4` bleed so a scrolled chart's left edge is not clipped.
 */
const CHART_SCROLL_CLASS =
  "overflow-x-scroll pl-4 -ml-4 2xl:overflow-visible 2xl:pl-0 2xl:ml-0";

/** «N more note(s)» reveal button. */
const MORE_NOTES_BUTTON_CLASS =
  "w-full flex items-center gap-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground";

/* -------------------------------------------------------------------------- */
/*                                 ChartPanel                                 */
/* -------------------------------------------------------------------------- */

/**
 * Measured [1115.5 × 524/532] on both the `index` tab (no legend, `showColorBy`)
 * and the `benchmark-score-by-eval` tab (legend, no `showColorBy`) — one and the
 * same component, the 40px delta being `ChartCardHeader`'s "Color by" row.
 */
export function ChartPanel({
  title,
  caption,
  notes,
  children,
  legend,
  annotation,
  scatterChart,
  showColorBy = true,
  showModelPicker = true,
  modelCount = "21 of 21 models",
}: {
  title: string;
  caption: React.ReactNode;
  notes: ChartNote[];
  /** The chart, or a `<ChartEmptyState />`. */
  children: React.ReactNode;
  /** e.g. `<BenchmarkLegend />`; omitted on most tabs. */
  legend?: React.ReactNode;
  /**
   * Extra key ABOVE the legend slot — measured only on `input-vs-output-tokens`,
   * which carries `<QuadrantLegend />` there (kid 1, pushing the legend to kid 2).
   */
  annotation?: React.ReactNode;
  /**
   * Use the scatter charts' chart wrapper instead of the tabbed default. Measured
   * on `input-vs-output-tokens`, whose whole body is the scatter-card body: the
   * wrapper is `relative mt-2 overflow-x-scroll 2xl:overflow-visible` (no
   * `pl-4 -ml-4` bleed, no inner scroll div) and its watermark sits at inset 12,
   * not 4. That `mt-2` is worth a real 8px in the panel height.
   */
  scatterChart?: boolean;
  showColorBy?: boolean;
  /** `false` on all 4 harness-comparison tabs — see spec §4a. */
  showModelPicker?: boolean;
  modelCount?: string;
}) {
  return (
    <div className="scroll-mt-24">
      <div className="flex flex-col gap-5 mb-5">
        <ChartCardHeader
          title={title}
          caption={caption}
          showColorBy={showColorBy}
          showModelPicker={showModelPicker}
          modelCount={modelCount}
        />
        <div className="w-full">
          <div className="w-full">
            {/* Verified on both tabs: kid 0 is always childless and height 0.
                Rendered anyway for DOM fidelity. */}
            <div className="text-sm text-neutral-500 flex flex-col" />
            {annotation}
            {/* The legend slot, height 0 when empty. `BenchmarkLegend` and
                `CreatorLegend` each emit their own measured root
                (`div.flex.flex-col.gap-1` and `div.mt-2` respectively), so a
                passed legend REPLACES the empty wrapper (no double nesting). */}
            {legend ?? <div className="flex flex-col gap-1" />}
            {scatterChart ? (
              <div className="relative mt-2 overflow-x-scroll 2xl:overflow-visible">
                <ChartWatermark />
                {children}
              </div>
            ) : (
              <div className="relative">
                {/* inset 4 ⇒ top/right 4px, opacity 0.75 — matches the measured
                    inline style on this variant (the scatter cards use 12/0.65). */}
                <ChartWatermark inset={4} />
                <div className={CHART_SCROLL_CLASS}>{children}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ChartNotes notes={notes} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 ChartNotes                                 */
/* -------------------------------------------------------------------------- */

export type ChartNote = { title: string; body: React.ReactNode };

/**
 * Only `notes[0]` is visible initially; clicking «N more notes» reveals ALL the
 * rest and the button disappears. One-way: the target offers no way to
 * re-collapse, so this is `useState(false)` with no reverse transition.
 *
 * Both wrapper divs are className-less in the target — kept as measured.
 *
 * Deviation (see spec §2): the target's first `AccordionItem` carries
 * `className="border-none"` while the revealed ones carry none. `MetricAccordion`
 * hard-codes `border-none`, and since Radix never adds a border there it is a
 * visual no-op — `MetricAccordion` is reused unchanged for every note rather
 * than editing `chart-card.tsx`.
 */
export function ChartNotes({ notes }: { notes: ChartNote[] }) {
  const [revealed, setRevealed] = React.useState(false);

  const visible = revealed ? notes : notes.slice(0, 1);
  const hidden = notes.length - visible.length;

  return (
    <div>
      <div>
        {visible.map((note) => (
          <MetricAccordion key={note.title} title={note.title}>
            {note.body}
          </MetricAccordion>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className={MORE_NOTES_BUTTON_CLASS}
          >
            <Plus className="h-3 w-3 shrink-0" />{" "}
            <span>{`${hidden} more note${hidden === 1 ? "" : "s"}`}</span>
          </button>
        )}
      </div>
    </div>
  );
}

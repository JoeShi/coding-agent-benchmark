#!/usr/bin/env python3
"""Emit app/site/src/data/sections.ts from the measured research JSON.

Every user-visible string in the generated file is *copied* from a measurement
artifact rather than retyped, so the clone cannot drift from the target through a
transcription slip:

  _tab-colorby.json   section id / h2 / description / tab order / tab slugs /
                      per-tab `showColorBy` / presence of the model picker
  _all-tab-notes.json per-tab h3, caption, and the full note list (title+paras)
  _tab-copy.json      the three scatter cards' h3, caption, note title+paras
  _tab-heights.json   chart heights for section 1-2 tabs
  _tab-heights2.json  chart heights for section 3-5 tabs (lazy-mounted; these
                      were measured after scrolling each section into view)

The only hand-authored content is WIRING below: which of our metrics backs each
tab, and — for the tabs our run cannot populate — the empty-state reason.

Run:  python3 docs/research/gen_sections.py
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
RESEARCH = ROOT / "docs" / "research"
OUT = ROOT / "app" / "site" / "src" / "data" / "sections.ts"


def load(name):
    d = json.loads((RESEARCH / name).read_text())
    while isinstance(d, str):
        d = json.loads(d)
    return d


# --------------------------------------------------------------------------- #
#                                   WIRING                                    #
# --------------------------------------------------------------------------- #
# Keyed by tab slug. Either:
#   ("bar", metric)      -> BenchmarkBarChart over that metric
#   ("grouped", None)    -> GroupedBenchmarkBarChart (all 3 benchmarks)
#   ("empty", reason)    -> ChartEmptyState, height taken from the measurement
WIRING = {
    # ---- section 1: populated from our own trial records -------------------
    "index": ("bar", "index"),
    "benchmark-score-by-eval": ("grouped", None),
    "deep-swe": ("bar", "deep-swe"),
    "terminal-bench-v2": ("bar", "terminal-bench-2"),
    "swe-atlas-qna": ("bar", "swe-atlas-qna"),
    # ---- section 2: one harness only --------------------------------------
    "harness-index": (
        "empty",
        "This run benchmarked a single harness (Kiro CLI), so there is no second "
        "harness to hold the model constant against.",
    ),
    "harness-deep-swe": (
        "empty",
        "This run benchmarked a single harness (Kiro CLI), so there is no second "
        "harness to hold the model constant against.",
    ),
    "harness-terminal-bench-v2": (
        "empty",
        "This run benchmarked a single harness (Kiro CLI), so there is no second "
        "harness to hold the model constant against.",
    ),
    "harness-swe-atlas-qna": (
        "empty",
        "This run benchmarked a single harness (Kiro CLI), so there is no second "
        "harness to hold the model constant against.",
    ),
    # ---- section 3: no token telemetry at all ------------------------------
    "token-usage": (
        "empty",
        "Kiro CLI reports Credits rather than token counts, so this run has no "
        "input, cached-input, or output token telemetry.",
    ),
    "token-distribution": (
        "empty",
        "Kiro CLI reports Credits rather than token counts, so there are no "
        "per-task token percentiles to plot.",
    ),
    "cache-efficiency": (
        "empty",
        "Kiro CLI reports Credits rather than token counts, so cached-input "
        "volume is not observable for this run.",
    ),
    "input-vs-output-tokens": (
        "empty",
        "Kiro CLI reports Credits rather than token counts, so input and output "
        "cannot be separated for this run.",
    ),
    "tokens-by-benchmark": (
        "empty",
        "Kiro CLI reports Credits rather than token counts, so there is no "
        "per-benchmark token telemetry for this run.",
    ),
    # ---- section 4 --------------------------------------------------------
    "cost-to-run": ("bar", "cost"),
    "cost-distribution": (
        "empty",
        "This run records the mean cost per task, not the per-task "
        "distribution, so the P5-P95 spread is unavailable.",
    ),
    "total-cost": (
        "empty",
        "This run records mean cost per task only. The three benchmarks have "
        "unequal task counts, so summing the means would misstate total spend.",
    ),
    # ---- section 5 --------------------------------------------------------
    "agent-time": ("bar", "time"),
    "mean-steps": (
        "empty",
        "Kiro CLI headless output reports Credits and wall time, not the number "
        "of agent turns.",
    ),
}

# Scatter cards, keyed by section id. `x` names the metric on the x axis.
SCATTER_WIRING = {
    "token-usage": (
        "empty",
        "Kiro CLI reports Credits rather than token counts, so this run has no "
        "total-token figure to plot against the index.",
    ),
    "cost-to-run": ("scatter", "cost"),
    "execution-time": ("scatter", "time"),
}

# Tab slug -> which colour key the panel's legend slot carries. Re-measured at
# 1440 across all 19 tabs: five tabs ship one, and it is NOT always the
# benchmark key.
#
#   "benchmark" -> <BenchmarkLegend />, root `div.flex.flex-col.gap-1`, h 24,
#                  no margin (the multi-series tabs).
#   "creator"   -> <CreatorLegend />,   root `div.mt-2`, h 24 + 8px margin.
#
# Everything else has the empty 0-height slot. Getting this wrong is a real
# height bug: a missing creator key made four panels 24-32px short.
LEGEND_TABS = {
    "benchmark-score-by-eval": "benchmark",
    "tokens-by-benchmark": "benchmark",
    "token-distribution": "creator",
    "input-vs-output-tokens": "creator",
    "cost-distribution": "creator",
}

# Tabs whose panel body is the SCATTER-card body rather than the tabbed default:
# a <QuadrantLegend /> above the legend slot, and the chart in
# `relative mt-2 overflow-x-scroll 2xl:overflow-visible` (watermark inset 12)
# instead of a bare `relative` + `pl-4 -ml-4` scroll div. Measured: only one tab.
SCATTER_BODY_TABS = {"input-vs-output-tokens"}

# (section id, tab label) -> (chart-area height, explanatory comment lines).
# Overrides the measured `containerH` where we deliberately let the empty state
# stand in for MORE than the plot.
CHART_HEIGHT_OVERRIDES = {
    ("token-usage", "Token Usage"): (
        388,
        [
            "388, not the measured 320: this is the only tab whose chart area is",
            "not the bare plot. Measured on the target — `div.w-full > div.w-full`",
            "= mt-2 8 + series legend 24 + plot 320 + mt-5 20 + cache-rate",
            "footnote 16 = 388. That legend is a series key (Output / Cached Input",
            "/ Input) for data we do not have and the footnote quotes a cache rate",
            "we cannot compute, so unlike the four creator/benchmark keys these",
            "are NOT reproduced; the empty state carries the whole 388 instead and",
            "`#token-usage` keeps its measured height.",
        ],
    ),
}


# --------------------------------------------------------------------------- #
#                                  helpers                                    #
# --------------------------------------------------------------------------- #
def ts(s):
    """Emit a TS double-quoted string literal."""
    return json.dumps(s, ensure_ascii=False)


def slug_of(tab):
    """`radix-<id>-trigger-<slug>` -> `<slug>`."""
    marker = "-trigger-"
    v = tab["value"]
    assert marker in v, v
    return v.split(marker, 1)[1]


def main():
    colorby = load("_tab-colorby.json")
    notes_doc = load("_all-tab-notes.json")["out"]
    copy_doc = load("_tab-copy.json")["out"]
    h1 = load("_tab-heights.json")
    h2 = load("_tab-heights2.json")

    # (section id, tab label) -> notes entry
    notes_by = {(e["section"], e["tabLabel"]): e for e in notes_doc}

    # (section id, tab label) -> measured chart height
    heights = {}
    for doc in (h1, h2):
        for sec in doc["sections"]:
            for t in sec["tabs"]:
                if t.get("containerH"):
                    heights[(sec["id"], t["label"])] = t["containerH"]

    # section id -> scatter card copy. The `p-8` scatter card is the one whose
    # single panel has no tab label (`tabs` is null on the tabbed cards too in
    # this artifact, so it is not a usable discriminator). Sections 1-2 have no
    # scatter card at all.
    scatter_copy = {}
    for sec in copy_doc:
        for card in sec["cards"]:
            panels = card["panels"]
            if len(panels) == 1 and panels[0].get("tab") is None:
                scatter_copy[sec["id"]] = panels[0]

    # section id -> measured scatter chart height
    scatter_h = {}
    for doc in (h1, h2):
        for sec in doc["sections"]:
            for c in sec.get("scatterCards") or []:
                if c.get("containerH"):
                    scatter_h[sec["id"]] = c["containerH"]

    out = []
    w = out.append

    w('/**')
    w(' * GENERATED by docs/research/gen_sections.py — do not hand-edit.')
    w(' *')
    w(' * Section headings, descriptions, tab order, tab slugs, chart titles,')
    w(' * captions, note copy, per-tab `showColorBy` / `showModelPicker`, and every')
    w(' * chart height are COPIED from the measurement artifacts in docs/research/')
    w(' * (see that script\'s docstring for which file supplies which field). Editing')
    w(' * a string here would silently desync the clone from the target; re-measure')
    w(' * and re-run the generator instead.')
    w(' *')
    w(' * The `render` discriminator and any `reason` text ARE ours: they say which of')
    w(' * our metrics backs each tab, and why a tab our run cannot populate falls back')
    w(' * to <ChartEmptyState />.')
    w(' */')
    w('')
    w('import type { BenchmarkId } from "@/types/leaderboard";')
    w('')
    w('/** Which of our own measurements drives a single-series bar chart. */')
    w('export type BarMetric = "index" | "cost" | "time" | BenchmarkId;')
    w('')
    w('export type TabRender =')
    w('  | { kind: "bar"; metric: BarMetric }')
    w('  /** All three benchmarks side by side (`benchmark-score-by-eval`). */')
    w('  | { kind: "grouped" }')
    w('  | { kind: "empty"; reason: string };')
    w('')
    w('/**')
    w(' * Which colour key the panel\'s legend slot carries. `"benchmark"` is the')
    w(' * multi-series key, `"creator"` the per-creator chip row (which also brings an')
    w(' * 8px `mt-2` with it); most tabs have neither and ship the empty 0-height slot.')
    w(' */')
    w('export type TabLegend = "none" | "benchmark" | "creator";')
    w('')
    w('export interface TabNote {')
    w('  title: string;')
    w('  /** Rendered as one `<p>` each inside MetricAccordion\'s `space-y-2`. */')
    w('  paras: string[];')
    w('}')
    w('')
    w('export interface TabSpec {')
    w('  /** URL slug; also the Radix Tabs value. */')
    w('  slug: string;')
    w('  /** Tab trigger text. */')
    w('  label: string;')
    w('  /** Panel `h3`. */')
    w('  title: string;')
    w('  caption: string;')
    w('  notes: TabNote[];')
    w('  showColorBy: boolean;')
    w('  showModelPicker: boolean;')
    w('  /** Measured chart height in px. */')
    w('  chartHeight: number;')
    w('  legend: TabLegend;')
    w('  /**')
    w('   * Render the panel body the way the SCATTER cards do — a quadrant key above')
    w('   * the legend slot and the chart in `relative mt-2 overflow-x-scroll')
    w('   * 2xl:overflow-visible` (watermark inset 12). Measured on one tab.')
    w('   */')
    w('  scatterBody: boolean;')
    w('  render: TabRender;')
    w('}')
    w('')
    w('export type ScatterRender =')
    w('  | { kind: "scatter"; metric: "cost" | "time" }')
    w('  | { kind: "empty"; reason: string };')
    w('')
    w('export interface ScatterSpec {')
    w('  title: string;')
    w('  caption: string;')
    w('  note: TabNote;')
    w('  chartHeight: number;')
    w('  render: ScatterRender;')
    w('}')
    w('')
    w('export interface SectionSpec {')
    w('  /** Anchor id; matches the scroll-spy sidebar href. */')
    w('  id: string;')
    w('  heading: string;')
    w('  description: string;')
    w('  /** URL query param the active tab mirrors into. */')
    w('  param: string;')
    w('  tabs: TabSpec[];')
    w('  /** The `p-8` scatter card below the tabbed card, where the target has one. */')
    w('  scatter?: ScatterSpec;')
    w('}')
    w('')
    w('export const SECTIONS: SectionSpec[] = [')

    for sec in colorby["sections"]:
        sid = sec["id"]
        w("  {")
        w(f"    id: {ts(sid)},")
        w(f"    heading: {ts(sec['h2'])},")
        w(f"    description: {ts(sec['desc'])},")
        w(f"    param: {ts(sec['param'])},")
        w("    tabs: [")

        for tab in sec["tabs"]:
            slug = slug_of(tab)
            label = tab["label"]
            entry = notes_by[(sid, label)]
            assert entry["h3"] == tab["h3"], (entry["h3"], tab["h3"])
            kind, arg = WIRING[slug]
            height, height_why = CHART_HEIGHT_OVERRIDES.get(
                (sid, label), (heights[(sid, label)], None)
            )

            w("      {")
            w(f"        slug: {ts(slug)},")
            w(f"        label: {ts(label)},")
            w(f"        title: {ts(entry['h3'])},")
            w(f"        caption: {ts(entry['caption'])},")
            w(f"        showColorBy: {'true' if tab['colorBy'] else 'false'},")
            # Measured: the harness tabs ship no combobox row at all.
            w(f"        showModelPicker: "
              f"{'false' if tab['modelCount'] is None else 'true'},")
            if height_why:
                w("        /*")
                for line in height_why:
                    w(f"         * {line}")
                w("         */")
            w(f"        chartHeight: {height},")
            w(f"        legend: {ts(LEGEND_TABS.get(slug, 'none'))},")
            w(f"        scatterBody: "
              f"{'true' if slug in SCATTER_BODY_TABS else 'false'},")
            if kind == "bar":
                w(f'        render: {{ kind: "bar", metric: {ts(arg)} }},')
            elif kind == "grouped":
                w('        render: { kind: "grouped" },')
            else:
                w('        render: {')
                w('          kind: "empty",')
                w(f"          reason:\n            {ts(arg)},")
                w('        },')
            w("        notes: [")
            for n in entry["notes"]:
                w("          {")
                w(f"            title: {ts(n['title'])},")
                w("            paras: [")
                for p in n["paras"]:
                    w(f"              {ts(p)},")
                w("            ],")
                w("          },")
            w("        ],")
            w("      },")

        w("    ],")

        if sid in scatter_copy:
            sc = scatter_copy[sid]
            kind, arg = SCATTER_WIRING[sid]
            w("    scatter: {")
            w(f"      title: {ts(sc['h3'])},")
            w(f"      caption: {ts(sc['caption'])},")
            w(f"      chartHeight: {scatter_h[sid]},")
            if kind == "scatter":
                w(f'      render: {{ kind: "scatter", metric: {ts(arg)} }},')
            else:
                w('      render: {')
                w('        kind: "empty",')
                w(f"        reason:\n          {ts(arg)},")
                w('      },')
            w("      note: {")
            w(f"        title: {ts(sc['accTitle'])},")
            w("        paras: [")
            for p in sc["notes"]:
                w(f"          {ts(p)},")
            w("        ],")
            w("      },")
            w("    },")

        w("  },")

    w("];")
    w("")

    OUT.write_text("\n".join(out))
    n_tabs = sum(len(s["tabs"]) for s in colorby["sections"])
    n_empty = sum(1 for k in WIRING.values() if k[0] == "empty")
    print(f"wrote {OUT.relative_to(ROOT)}: "
          f"{len(colorby['sections'])} sections, {n_tabs} tabs "
          f"({n_tabs - n_empty} populated, {n_empty} empty-state), "
          f"{len(scatter_copy)} scatter cards")


if __name__ == "__main__":
    main()

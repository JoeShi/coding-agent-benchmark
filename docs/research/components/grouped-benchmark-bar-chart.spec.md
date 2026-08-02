# Component spec: `GroupedBenchmarkBarChart` + `BenchmarkLegend`

The chart in the **`benchmark-score-by-eval`** tab («Score by Benchmark») of
`#coding-agents-index`. Three series (one per component benchmark) grouped per
agent. It is **not** a variant of `BenchmarkBarChart` — different margins, bar
width, radius, label rotation and an extra legend — so do not modify that file.

## Files to create (create ONLY these)

| file | exports |
|---|---|
| `src/components/grouped-benchmark-bar-chart.tsx` | `GroupedBenchmarkBarChart`, `BenchmarkLegend`, `BENCHMARK_SERIES` |

`"use client"`.

> Read `app/site/AGENTS.md` first — Next 16 / Tailwind v4 / recharts 2.15.4.
> No borders in this component; do not add any (a bare `border` renders BLACK
> under the v4 preflight).

Depends on `@/lib/leaderboard` (`AgentRow`, `agentLogo`, `creatorLogo`) and
`@/types/leaderboard` (`BenchmarkId`). **Read them; do not edit them.**

---

## `BENCHMARK_SERIES`

Measured off the legend chips and the bar `fill` attributes — exact, do not
adjust by eye:

```ts
export const BENCHMARK_SERIES: { id: BenchmarkId; label: string; color: string }[] = [
  { id: "deep-swe",        label: "DeepSWE",          color: "#2563eb" },  // rgb(37, 99, 235)
  { id: "terminal-bench-2", label: "Terminal-Bench v2", color: "#14b8a6" }, // rgb(20, 184, 166)
  { id: "swe-atlas-qna",   label: "SWE-Atlas-QnA",    color: "#f59e0b" },  // rgb(245, 158, 11)
];
```

Order matters — it is the DOM order of both the legend and the three `<Bar>`s.

## `BenchmarkLegend`

```tsx
export function BenchmarkLegend(): React.ReactElement
```

Measured verbatim (wrapper is `1115.5 × 24`); non-functional, no `onClick`:

```tsx
<div className="flex flex-col gap-1">
  <div className="text-sm flex flex-wrap items-center">
    {BENCHMARK_SERIES.map(({ label, color }) => (
      <button key={label} type="button" data-state="closed"
              className="flex items-center gap-1 px-1.5 py-0.5"
              style={{ backgroundColor: "transparent" }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span>{label}</span>
      </button>
    ))}
  </div>
</div>
```

Computed per button: 14px/20px w400 `rgb(0,0,0)`, `padding 2px 6px`, `gap 4px`,
transparent bg, height 24; widths 89.5 / 144.6 / 126. Chip 8×8, `radius 9999px`.

Note the target emits no `type` attribute on these buttons; add `type="button"`
anyway so React does not default them to submit.

---

## `GroupedBenchmarkBarChart` — props

```tsx
export function GroupedBenchmarkBarChart(props: {
  rows: AgentRow[];   // already sorted + sliced by the caller (15 on the target)
}): React.ReactElement
```

Values are `row.benchmarks[id]` (0–1 fractions) rendered on a **0–100** axis, so
plot `(row.benchmarks[id] ?? 0) * 100`. Build the recharts `data` array yourself
with one object per row carrying `label` plus the three series keys.

## Container

```
div.w-full   →   <ResponsiveContainer width="100%" height={320}>
```
Surface measured `viewBox="0 0 1116 320"`, `width="1116" height="320"`,
`style="width: 100%; height: 100%; display: block;"`. Wrapper `1116 × 320`.

## Geometry (measured — do not estimate)

- **Clip rect measured `x=20 y=40 w=1096 h=160`** → plot area x∈[20,1116],
  y∈[40,200]. As with `BenchmarkBarChart`, recharts 2.15.4's `calculateOffset`
  *adds* the visible XAxis's own `height` (default 30) to `margin.bottom`, so the
  measured bottom offset of 120 needs:
  ```tsx
  <BarChart margin={{ top: 40, right: 0, bottom: 90, left: 20 }}>
  ```
  Verify the emitted `<clipPath><rect>` is `y="40" height="160"`.
- `<YAxis hide domain={[0, 100]} />` — 100 units over 160 px.
- `<CartesianGrid vertical={false} stroke="#ccc" strokeDasharray="2 4" />` —
  horizontal only, **dashed** (`stroke rgb(204,204,204)`, dash `2px, 4px`),
  5 lines at y **200 / 160 / 120 / 80 / 40**.
- **45 bars = 3 series × 15 rows**, each `width="18"`, `radius={[2, 2, 0, 0]}`
  (recharts emits a `<path>` with `A 2,2` arcs, not a `<rect>`).
  Measured first-bar x per series: `27.3067` / `47.3067` / `67.3067`;
  group step `73.0667`; within-group step `20`.
- **Derivation (state this arithmetic in your report and confirm it):**
  bandSize = `1096 / 15 = 73.0667`.
  `offset = 27.3067 − 20 = 7.3067 = 0.10 × 73.0667` → `barCategoryGap="10%"`
  (which is recharts' default, so it may be omitted — say which you did).
  within-group step 20 = barSize 18 + barGap 2 → `barGap={2}`.
  Cross-check with recharts' own formula
  `originalSize = (bandSize − 2·offset − (len−1)·realBarGap) / len`
  `= (73.0667 − 14.6134 − 4) / 3 = 18.1511`, then `>>= 0` → **18** ✓.
- No `<Tooltip>`, no `<Legend>`, no `activeBar`, `isAnimationActive={false}`.
  The chart is fully static.

## Value labels — rotated −60°

One `<LabelList>` per `<Bar>`. Measured verbatim per label:

```
<text x={bar.x + 5} y={bar.y − 4} font-size="10" text-anchor="start"
      dominant-baseline="middle" transform={`rotate(-60, ${x}, ${y})`}
      opacity="1" fill="rgb(0, 0, 0)">{value}</text>
```

Values are the rounded percentage (`Math.round(v)`), matching the target's
`60 69 66 63 60 …`. Because `LabelList` does not emit a `transform`, supply a
custom `content` renderer that returns exactly that `<text>` (recharts passes
`{ x, y, width, value }`; the anchor is `x + 5`, `y − 4` — note `y` from
`LabelList` is already the bar top, so no extra offset).

This is the one place where `top: 40` in the margin matters: the rotated labels
occupy that 40px band above the plot.

## XAxis ticks — identical to `BenchmarkBarChart`

```tsx
<XAxis dataKey="label" tickLine={false} axisLine={false} interval={0}
       tick={<BenchmarkTick rows={rows} />} />
```

The emitted tick markup is **byte-identical** to the one already specified in
`benchmark-bar-chart.spec.md` (verified by diffing this tab's
`recharts-zIndex-layer_2000` dump against that spec): `translate(${x},208)`,
`<title>`/`<desc>`, inner `translate(-60, 8)`, agent logo `<image x="28" y="-7.5"
width="13" height="13" preserveAspectRatio="xMidYMid meet">`, `<text x="43" y="0"
fontSize="9px" fontWeight="500" dominantBaseline="middle">`, creator logo
`<image x="28" y="8.5" …>`, `<text x="43" y="16" …>` with the model name split
into base + parenthesised suffixes, each suffix preceded by one empty spacer
`<tspan x="43" dy="12" />` and rendered `fontSize="9px" fill="#737373"
fontWeight="500"`.

Note `208` here is again `plotBottom (200) + 8`, so the same hard-coded constant
is correct even though the plot top differs.

**Do not import from `benchmark-bar-chart.tsx`** (it does not export the tick)
and do not edit it — duplicate the tick renderer inside this file and say so in
your report.

## Constraints

- Create only `src/components/grouped-benchmark-bar-chart.tsx`.
- Do not touch `benchmark-bar-chart.tsx`, `highlight-bar-chart.tsx`,
  `chart-card.tsx`, `globals.css`, `leaderboard.ts`, `page.tsx`, or any other
  existing file.
- Run `npx tsc --noEmit` from `app/site` and report the result. If any measured
  number cannot be reproduced with recharts 2.15.4, say so explicitly with the
  arithmetic rather than silently changing it.

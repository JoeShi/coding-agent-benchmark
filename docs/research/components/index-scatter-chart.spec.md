# Component spec: `IndexScatterChart` + `ScatterCard`

The `p-8` bordered card that appears as the **second** card in sections
`#token-usage`, `#cost-to-run` and `#execution-time`. Title pattern:
"Artificial Analysis Coding Agent Index vs. {X}". One component, three uses.

## Files to create (create ONLY these)

| file | exports |
|---|---|
| `src/components/index-scatter-chart.tsx` | `IndexScatterChart` |
| `src/components/scatter-card.tsx` | `ScatterCard` |

Both `"use client"`.

> Read `app/site/AGENTS.md` first — Next 16 / Tailwind v4 / recharts 2.15.4.
> Tailwind v4 preflight defaults `border-color` to `currentColor`, so the
> measured `1px solid rgb(217,217,217)` card border must be written
> `border border-border`.

Depends on `@/lib/leaderboard` (`AgentRow`, `creatorColor`, `CREATOR_COLORS`) and
on `ChartCardHeader` + `MetricAccordion` from `@/components/chart-card`, and
`ChartWatermark` from `@/components/icons`. **Read those files; do not edit them.**
If `chart-card.tsx` does not exist yet, still import from it — it is being built
in parallel and will export `ChartCardHeader` and `MetricAccordion`.

---

## `ScatterCard`

```tsx
export function ScatterCard(props: {
  title: string;            // e.g. "Artificial Analysis Coding Agent Index vs. Total Tokens"
  caption: React.ReactNode;
  xLabel: string;           // e.g. "Total Tokens"
  rows: AgentRow[];
  xOf: (r: AgentRow) => number;
  xTickFormat: (v: number) => string;
  note: React.ReactNode;    // body of the "How to Read This Chart" accordion
})
```

Measured structure (card is 1149.5 × 722):

```
div.scroll-mt-24.p-8.border.border-border.rounded-lg
├── div.flex.flex-col.gap-5.mb-5
│   ├── <ChartCardHeader title={title} caption={caption} />        (h 112)
│   └── div.w-full
│       └── div.w-full
│           ├── div.text-sm.text-neutral-500.flex.flex-col          (EMPTY, h 0 — render it anyway)
│           ├── div.mt-2.ml-1.flex.flex-wrap.items-center.gap-x-4.gap-y-1.text-sm   ← quadrant legend
│           ├── div.mt-2                                            ← creator legend
│           └── div.relative.mt-2.overflow-x-scroll.2xl:overflow-visible   (h 399)
│               ├── <ChartWatermark />                              ← absolute, see below
│               └── <IndexScatterChart ... />                       (ResponsiveContainer 1084×384)
└── <MetricAccordion title="How to Read This Chart">{note}</MetricAccordion>
```

Card computed: `padding 32px`, `border 1px solid rgb(217,217,217)`, `radius 8px`,
transparent background.

**Quadrant legend** — exactly one entry, verbatim:
```tsx
<div className="flex items-center gap-2">
  <div className="flex-shrink-0 w-4 h-3 rounded-sm border"
       style={{ background: "rgba(144,238,144,0.25)", borderColor: "rgba(144,238,144,0.4)" }} />
  <span>Most attractive quadrant</span>
</div>
```
(The inline `borderColor` overrides the v4 preflight default, so plain `border` is
correct here.)

**Creator legend** — `div.mt-2 > div.text-sm.flex.flex-wrap.items-center`, then one
button per distinct creator in `rows`, in first-appearance order:
```tsx
<button type="button" data-state="closed"
        className="flex items-center gap-1 px-1.5 py-0.5"
        style={{ backgroundColor: "transparent" }}>
  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: creatorColor(c) }} />
  <span>{c}</span>
</button>
```
Non-functional (no onClick).

**Watermark** — `ChartWatermark` from `@/components/icons` must render as
```
<svg viewBox="0 0 402 44" opacity="0.65"
     style="position:absolute;top:12px;right:12px;width:137px;height:15px;pointer-events:none;z-index:1">
```
Check the existing export's props; if it does not already accept/apply that
`style`, pass it via a `className`/`style` prop rather than editing `icons.tsx`.
If it cannot be styled from outside, wrap it in an absolutely-positioned
`<span>` with those coordinates instead.

---

## `IndexScatterChart` — geometry (all measured, do not estimate)

Surface: `viewBox="0 0 1084 384"`, `width="1084" height="384"`,
`style="width: 100%; height: 100%; display: block;"`. Use
`<ResponsiveContainer width="100%" height={384}>`.

Clip rect measured `x=65 y=5 w=1014 h=326` → plot area x∈[65,1079], y∈[5,331].
That means margins **left 65, top 5, right 5, bottom 53**, but as with the bar
chart recharts *adds* each visible axis's own size. Choose `margin` so the
emitted `<clipPath><rect>` is exactly `x=65 y=5 width=1014 height=326`, and state
the arithmetic you used in your report.

```tsx
<ScatterChart margin={{ ... }}>
  {/* quadrants — must paint BEHIND the axes and dots */}
  <ReferenceArea x1={0} x2={xMid} y1={yMid} y2={yMax}
                 fill="rgb(144, 238, 144)" fillOpacity={0.25} strokeOpacity={0} />
  <ReferenceArea x1={xMid} x2={xMax} y1={yMin} y2={yMid}
                 fill="rgb(235, 235, 235)" fillOpacity={0.25} strokeOpacity={0} />
  <XAxis type="number" dataKey="x" tickLine={false} axisLine={false}
         tick={{ fontSize: 11, fill: "#666" }} tickFormatter={xTickFormat}
         label={{ value: xLabel, position: "bottom", ... }} />
  <YAxis type="number" dataKey="y" tickLine={false} axisLine={false}
         tick={{ fontSize: 11, fill: "#666" }}
         label={{ value: "Artificial Analysis Coding Agent Index", angle: -90, ... }} />
  <Scatter data={points} isAnimationActive={false} shape={...} />
</ScatterChart>
```

- Measured green rect: `x=65 y=5 w=507 h=163` → the **top-left** quadrant (high
  index, low X). Grey rect: `x=572 y=168 w=507 h=163` → **bottom-right**. The
  split is at the exact plot midpoint on both axes: x 572 is the `15M` tick and y
  168 is the `50` tick. Compute `xMid`/`yMid` as the midpoint of each axis
  **domain**, not of the data.
- Axis lines and tick lines are absent from the DOM → `axisLine={false} tickLine={false}`.
- X ticks measured at y=341, `text-anchor="middle"`, `font-size 11`, `fill #666`,
  values `0 5M 10M 15M 20M 25M 30M` (7 ticks). Y ticks at x=55,
  `text-anchor="end"`, same font/fill, step 5 (`25 30 35 … `, 11 ticks).
- Axis titles: X at `x=572 y=374`, Y `transform="rotate(-90, 10, 168)"` at
  `x=10 y=168`. Both `font-size: 13px`, `fill: rgb(0, 0, 0)`,
  `text-anchor: middle` **set via inline style** (the `fill="#808080"` attribute
  is overridden). Pass `style={{ fill: "#000", fontSize: 13, textAnchor: "middle" }}`.
- Dots: `<circle r="6" fill={creatorColor(row.creator)} opacity="1" style={{ pointerEvents: "none" }} />`.
  Supply a custom `shape` so the fill is per-point. 15 points.

## Point labels

A separate `<g>` sibling layer, measured verbatim as:
```
<g transform="translate(65, 5)" pointer-events="none" aria-hidden="true">
  <g opacity="1">
    [optional] <line x1 y1 x2 y2 stroke="rgba(0, 0, 0, 0.2)" stroke-width="1" />
    <text x y font-size="11" font-weight="400" fill="rgba(0, 0, 0, 0.75)"
          dominant-baseline="hanging" stroke="white" stroke-width="2"
          stroke-linejoin="round" paint-order="stroke">{row.label}</text>
  </g>
  … × 15
</g>
```
Coordinates are **relative to the plot origin** (hence the `translate(65, 5)`).
The target runs a collision-avoidance solver; reproducing it exactly is out of
scope. Implement a **simple deterministic placement**: default the label just
below-right of its dot (`+8`, `+8` in plot coordinates), and where two labels
would overlap vertically within 12px, push the later one down and emit the leader
`<line>` from the label's anchor back to the dot. Keep the white-halo text
attributes byte-identical — that is what makes it read correctly.

Render this layer via a recharts `<Customized component={...} />` so it sits
inside the same surface, or as a second absolutely-positioned `<svg>` overlay if
`Customized` proves awkward; say which you chose.

## Constraints

- Create only the two files listed.
- Do not touch `globals.css`, `page.tsx`, `layout.tsx`, `icons.tsx`,
  `leaderboard.ts`, `chart-card.tsx`, or any existing component.
- Run `npx tsc --noEmit` from `app/site` and report the result.

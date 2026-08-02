# Component spec: `BenchmarkBarChart` (the wide in-card bar chart)

The chart used inside every tabbed card in the 5 main-grid sections. It is
**different from `highlight-bar-chart.tsx`** (already built): that one is 417×288
with a solid grid and rotated text ticks; this one is 1116×320 with a **dashed**
grid and a **two-row logo + text** tick. Do not reuse or modify that file.

## File to create (create ONLY this)

`src/components/benchmark-bar-chart.tsx` — `"use client"`, exports
`BenchmarkBarChart`.

> Read `app/site/AGENTS.md` first — Next 16 / Tailwind v4 / recharts 2.15.4.

## Props

```tsx
export function BenchmarkBarChart(props: {
  rows: AgentRow[];                       // already sorted + sliced by the caller
  valueOf: (r: AgentRow) => number;       // numeric value to plot
  labelOf: (r: AgentRow) => string;       // in-bar label text, e.g. formatIndex -> "67"
}): React.ReactElement
```

`AgentRow` and the helpers `creatorColor`, `agentLogo`, `creatorLogo` come from
`@/lib/leaderboard` (already written — read it, do not edit it). Each row has
`agent`, `model`, `label`, `creator`, plus the numeric fields.

## Container

```
div.w-full   →   <ResponsiveContainer width="100%" height={320}>
```
Measured wrapper is 1115.5 × 335 and the surface is `viewBox="0 0 1116 320"` with
`style="width: 100%; height: 100%; display: block;"`. Height 320 is fixed; width
comes from the parent.

## Geometry (measured — do not estimate)

- `<BarChart data={rows} margin={{ top: 24, right: 0, bottom: 90, left: 20 }}>`
  **The measured clip rect is `x=20 y=24 w=1096 h=176`, i.e. a bottom offset of
  120.** recharts 2.15.4's `calculateOffset` *adds* the XAxis's own
  `height` (default 30) to `margin.bottom`, so pass **90** and let the axis
  contribute the remaining 30. (This is exactly the correction the highlights
  builder had to make — same trick, different numbers. Verify by checking the
  emitted `<clipPath><rect>` has `y="24" height="176"`.)
- 15 bars, `width="54"`, first bar `x="29.1333"`, x step `73.0667`.
  Pick `barCategoryGap` so the rendered bar width is exactly **54**: recharts
  computes `originalSize = bandSize − 2·offset` then truncates with `>>= 0`.
  bandSize is `1096/15 = 73.0667`. Solve for the percentage that yields 54 and
  hard-code that string; then confirm the emitted `<path>` spans 54px.
- `<CartesianGrid vertical={false} stroke="#ccc" strokeDasharray="2 4" />` —
  horizontal only, **dashed**. 5 lines at y 200 / 156 / 112 / 68 / 24.
- `<YAxis hide />`
- `<Bar radius={[4, 4, 0, 0]} isAnimationActive={false}>` with one `<Cell>` per
  row, `fill={creatorColor(row.creator)}`.
- No `<Tooltip>`, no `<Legend>`, no `activeBar`. The chart is fully static.

## In-bar labels

```tsx
<LabelList
  dataKey={...}
  position="center"
  fill="white"
  fontSize={11}
  formatter={...}   // -> labelOf(row)
/>
```
Measured: `fill="white"`, `font-size 11px`, `text-anchor="middle"`, vertically
centred in the bar. Values on the target read `67 67 66 66 64 62 61 61 61 59 54 43 38 31 …`.

## XAxis tick renderer — the distinctive part

```tsx
<XAxis
  dataKey="label"
  tickLine={false}
  axisLine={false}
  interval={0}
  tick={<BenchmarkTick rows={rows} />}
/>
```

Emit exactly this shape per tick (captured verbatim from the target; `x` is the
bar centre, and the `208` is hard-coded — it is `plotBottom (200) + 8`):

```tsx
<g transform={`translate(${x},208)`} style={{ overflow: "visible" }}>
  <title>{row.label}</title>
  <desc>{`Label for ${row.label}`}</desc>
  <g transform="translate(-60, 8)">
    {agentLogo(row.agent) && (
      <image href={agentLogo(row.agent)} x="28" y="-7.5" width="13" height="13"
             preserveAspectRatio="xMidYMid meet" />
    )}
    <text x="43" y="0" fontSize="9px" fontWeight="500" dominantBaseline="middle">
      {row.agent}
    </text>
    {creatorLogo(row.creator) && (
      <image href={creatorLogo(row.creator)} x="28" y="8.5" width="13" height="13"
             preserveAspectRatio="xMidYMid meet" />
    )}
    <text x="43" y="16" fontSize="9px" fontWeight="500" dominantBaseline="middle">
      {base}
      {suffixes.map(s => (
        <React.Fragment key={s}>
          <tspan x="43" dy="12" />
          <tspan x="43" dy="12" fontSize="9px" fill="#737373" fontWeight="500">{s}</tspan>
        </React.Fragment>
      ))}
    </text>
  </g>
</g>
```

Row 1 = agent logo + `row.agent`. Row 2 = creator logo + the model name split
into a **base** and its **parenthesised suffixes**:

- `"Opus 5 (xhigh)"` → base `Opus 5`, suffixes `["(xhigh)"]`
- `"Fable 5 (max) (with fallback)"` → base `Fable 5`, suffixes `["(max)", "(with fallback)"]`
- `"Claude Opus 4.8"` → base `Claude Opus 4.8`, suffixes `[]`
- `"Auto"` → base `Auto`, suffixes `[]`

Parse with a regex that pulls every trailing `(...)` group. Each suffix is
preceded by **one empty spacer `<tspan x="43" dy="12" />`** and rendered in
`#737373`. Emit no spacer/suffix tspans when there are none.

Note recharts passes tick props as `{ x, y, payload: { value, index } }`; use
`payload.index` to look up `rows[i]`, and ignore the supplied `y` in favour of
the hard-coded `208`.

## Constraints

- Create only `src/components/benchmark-bar-chart.tsx`.
- Do not touch `highlight-bar-chart.tsx`, `globals.css`, `leaderboard.ts`,
  `page.tsx`, or any existing component.
- Tailwind v4 preflight makes a bare `border` black — not relevant here (no
  borders), but do not add any.
- Run `npx tsc --noEmit` from `app/site` and report the result. If any measured
  number cannot be reproduced with recharts 2.15.4, say so explicitly and give
  the arithmetic rather than silently changing it.

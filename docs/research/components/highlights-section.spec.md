# Component spec — Highlights Section

**Target files (create both, nothing else):**
- `app/site/src/components/highlight-bar-chart.tsx` — export `HighlightBarChart`
- `app/site/src/components/highlights-section.tsx` — export `HighlightsSection`

Both need `"use client"` (recharts).

All CSS below is `getComputedStyle()` output at viewport **1440**. Do not estimate.
**Mobile/responsive is out of scope** — only 1440 must be correct. Copy the responsive class
names listed verbatim (they cost nothing) but do not invent or verify breakpoint behaviour.

## INTERACTION MODEL

**Fully static.** No hover, click, or scroll behaviour. Recharts is used purely as a renderer:
pass `isAnimationActive={false}`, add no `<Tooltip>`, no `<Legend>`, no `activeBar`. The three
`h3` links are plain in-page anchors. Nothing else moves.

## Structure

```
section.container.mt-8.mb-24                                     box [0,640,1425,455]
├── p.text-sm.font-medium.border-b.pb-3.mb-6  «Highlights»
└── div.mb-16.lg:mb-24
    └── div.grid.gap-4.sm:grid-cols-1.lg:grid-cols-3             3 × 451px, gap 16
        └── (3×) div.border.rounded-lg.p-4.relative              451 × 398
            ├── div.flex.items-baseline.gap-2.mb-3
            │   ├── div.w-4.h-4.shrink-0.bg-brand-{…}            16×16
            │   └── h3.text-2xl.font-brand-serif.font-medium
            │       └── a[href="#…"]                             (bare, no classes)
            ├── div.text-xs.text-neutral-500.mb-4                caption
            ├── script[type="application/ld+json"]
            └── div.w-full
                └── div.h-60.lg:h-72.w-full                      417 × 288
                    └── ResponsiveContainer
```

Computed values:
- `p` «Highlights» — `font-size 14px`, `line-height 20px`, `font-weight 500`,
  `border-bottom 1px solid rgb(217,217,217)`, `padding-bottom 12px`, `margin-bottom 24px`.
- Card — `border 1px solid rgb(217,217,217)`, `border-radius 8px`, `padding 16px`,
  background transparent, `position relative`.
- `h3` — `font-size 24px`, `line-height 32px`, `font-weight 500`, serif family. Keep
  `font-brand-serif` on it explicitly (the global base rule only covers `h1`/`h2`).
- Caption — `font-size 12px`, `line-height 16px`, `color rgb(148,148,148)`, `margin-bottom 16px`.

## The three cards

| # | title | anchor href | swatch class | caption |
|---|---|---|---|---|
| 0 | `Coding Agent Index` | `#coding-agents-index` | `bg-brand-purple` | `Artificial Analysis Coding Agent Index v1.3 · Higher is better` |
| 1 | `Time per Task` | `#execution-time` | `bg-brand-yellow` | `Average agent wall time per task · Lower is better` |
| 2 | `Cost per Task` | `#cost-to-run` | `bg-brand-orange` | `Average API cost per task (USD) · Lower is better` |

The `·` is U+00B7 MIDDLE DOT. Swatch 0 computes to `rgb(136,66,253)`.

Data — import from `@/lib/leaderboard`:
```ts
import { getRows, formatIndex, formatCost, formatTime, creatorColor, agentLogo, creatorLogo } from "@/lib/leaderboard";
```
`getRows()` returns 21 rows sorted by `index` desc. Each card shows the **top 10** after its own sort:

| # | sort | bar value | bar label | tick label |
|---|---|---|---|---|
| 0 | `index` **desc** | `row.index` | `formatIndex(row.index)` (→ `37`) | `row.label` — single line |
| 1 | `time_seconds` **asc** | `row.time_seconds` | `formatTime(...)` (→ `8.3m`) | `` `${row.label}\n(${row.creator})` `` |
| 2 | `cost_usd` **asc** | `row.cost_usd` | `formatCost(...)` (→ `$0.41`) | `` `${row.label}\n(${row.creator})` `` |

Sort with a copy (`[...getRows()]`); do not mutate. Skip rows whose metric is `null`/`undefined`
before sorting, then `.slice(0, 10)`.

Bar `fill` is the **model creator's** brand colour — `creatorColor(row.creator)` — *not* the card's
swatch colour. Set it per-cell via `<Cell key={…} fill={…} />` inside `<Bar>`.

The `script[type="application/ld+json"]` on the target is SEO metadata. **Omit it** — out of scope.

## `HighlightBarChart`

Props: `rows` (the pre-sorted, pre-sliced 10), plus accessors for value / bar label / tick label.
Wrap in `<div className="w-full"><div className="h-60 lg:h-72 w-full">` and render a
`<ResponsiveContainer width="100%" height="100%">`.

Measured recharts geometry — viewBox `0 0 417 288`, plot area x 20→417, y 0→168. Reproduce with:
```tsx
<BarChart data={rows} margin={{ top: 0, right: 0, bottom: 120, left: 20 }} barCategoryGap="..." >
```
Bars measure `width 29` at an x step of `39.7`, so let recharts derive the gap from the 10
categories rather than hard-coding widths; verify the rendered `<rect width>` lands on ~29.

- `<CartesianGrid vertical={false} stroke="#ccc" />` — horizontal only, 5 lines at y 0/42/84/126/168.
- `<YAxis hide />`
- `<XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={<HighlightTick … />} />`
- `<Bar dataKey=… radius={[4, 4, 0, 0]} isAnimationActive={false}>` containing the `<Cell>`s and
  ```tsx
  <LabelList position="center" fill="white" fontSize={11} fontWeight={400} formatter={…} />
  ```
  (computed label style: `font-size 11px`, weight 400, suisseIntl, `fill white`).

**Custom tick renderer** — recharts passes `{ x, y, payload }`; ignore `y` and hard-code 176.
Emit exactly this shape (verbatim from the target, inline styles included):
```tsx
<g transform={`translate(${x},176)`} style={{ overflow: "visible" }}>
  <g style={{ transform: "translate(-17px, 0px)" }}>
    <svg>
      <title>{label}</title>
      <desc>{`Logo of ${label}`}</desc>
      {logoA && <image href={logoA} x="0" height="16px" width="16px" preserveAspectRatio="xMidYMid meet" />}
      {logoB && <image href={logoB} x="18" height="16px" width="16px" preserveAspectRatio="xMidYMid meet" />}
    </svg>
  </g>
  <g style={{ transform: "translate(-80px, 26px)" }}>
    <foreignObject width="80" height="11" style={{ overflow: "visible", pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "end", transform: "translateY(-50%)" }}>
        <div style={{ transform: "rotate(-60deg)", transformOrigin: "100% 50%" }}>
          <div style={{ fontSize: 11, lineHeight: 1, textAlign: "right", textWrap: "balance", wordBreak: "break-word", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
            {label}
          </div>
        </div>
      </div>
    </foreignObject>
  </g>
</g>
```
`logoA = agentLogo(row.agent)`, `logoB = creatorLogo(row.creator)`. Look the row up from `rows` by
matching `payload.value` against `row.label`.

For cards 1 and 2 the tick label contains a `\n`; render it as two `<div>` lines (or a
`whiteSpace: "pre-line"` on the innermost div) inside the rotated wrapper — the rotation and
clamp wrapper stay identical.

`textWrap` and `WebkitLineClamp` need no casts in React 19's `CSSProperties`; if tsc complains,
move that object into a `const … : React.CSSProperties` rather than using `as any`.

## Acceptance

- `npx tsc --noEmit` passes.
- Create **only** the two files named above. Do not touch any other file.
- At 1440: section spans the full container with `margin: 32px 0 96px`; three 451×398 bordered
  cards with `gap 16`; each chart 417×288 with 5 horizontal `#ccc` gridlines and 10 bars of
  width ≈29 with 4px top corner radii; every bar carries a centred white 11px value label; every
  tick shows two 16×16 logos above a −60°-rotated label.
- Card 0's bars are ordered tallest→shortest; cards 1 and 2 shortest→tallest.
- No tooltip appears on hover, and no bar animates on mount.

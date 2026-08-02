# Component spec: `ChartPanel` + `ChartNotes` + `ChartEmptyState` (+ one `ChartCardHeader` amendment)

Every one of the 19 tabbed cards has the **same** panel body. This spec captures
it once so Phase 4 only supplies copy + which chart to embed. It also closes a
measurement gap in `section-shell.spec.md` (see §4 — that spec described only the
`showColorBy` variant of `ChartCardHeader`).

## Files (create the first two; amend the third, nothing else)

| file | action | exports |
|---|---|---|
| `src/components/chart-panel.tsx` | **create** | `ChartPanel`, `ChartNotes`, `type ChartNote` |
| `src/components/chart-empty-state.tsx` | **create** | `ChartEmptyState` |
| `src/components/chart-card.tsx` | **amend only as described in §4** | (adds 2 optional props to `ChartCardHeader`) |

`chart-panel.tsx` and `chart-empty-state.tsx` are `"use client"`.

> Read `app/site/AGENTS.md` first — Next 16 / Tailwind v4.
> Tailwind v4 preflight defaults `border-color` to `currentColor`; a bare
> `border`/`border-b` renders BLACK. There are **no** borders in the panel body —
> do not add any.
> Do **not** run any verbatim class string below through `cn()`/`twMerge`: it
> silently drops classes the target ships. Plain string concatenation only.

Imports: `ChartCardHeader`, `MetricAccordion` from `@/components/chart-card`;
`ChartWatermark` from `@/components/icons`; lucide `Plus`.
**Read those files; the only permitted edit is the §4 amendment.**

---

## 1. `ChartPanel`

```tsx
export function ChartPanel(props: {
  title: string;
  caption: React.ReactNode;
  notes: ChartNote[];
  children: React.ReactNode;      // the chart (or a <ChartEmptyState/>)
  legend?: React.ReactNode;       // e.g. <BenchmarkLegend/>; omitted on most tabs
  showColorBy?: boolean;          // default true
  modelCount?: string;            // combobox label, default "21 of 21 models"
}): React.ReactElement
```

Measured structure — identical on the `index` tab (no legend, `showColorBy`) and
the `benchmark-score-by-eval` tab (legend, no `showColorBy`), so it is one
component:

```
div.scroll-mt-24                                              [1115.5 × 524 / 532]
├── div.flex.flex-col.gap-5.mb-5                              (h 467 / 451)
│   ├── <ChartCardHeader title caption showColorBy modelCount />   (h 112 / 72)
│   └── div.w-full
│       └── div.w-full
│           ├── div.text-sm.text-neutral-500.flex.flex-col     ← ALWAYS EMPTY, h 0
│           ├── div.flex.flex-col.gap-1                        ← legend slot, h 0 when empty
│           └── div.relative                                   (h 335 for a 320-high chart)
│               ├── <ChartWatermark inset={4} />
│               └── div.overflow-x-scroll.pl-4.-ml-4.2xl:overflow-visible.2xl:pl-0.2xl:ml-0
│                   └── {children}
└── <ChartNotes notes={notes} />
```

Verified on both tabs: kid 0 is `div.text-sm text-neutral-500 flex flex-col` with
`children.length === 0` and height 0 — **render it anyway** (empty element, no
children) for DOM fidelity. Kid 1 is `div.flex flex-col gap-1`, height 0 when
there is no legend; when a legend is passed it is `{legend}` **instead of** an
empty wrapper, because `BenchmarkLegend` already emits exactly
`div.flex.flex-col.gap-1` as its own root. So:

```tsx
{legend ?? <div className="flex flex-col gap-1" />}
```

**Watermark:** measured inline style on this variant is
`position:absolute; top:4px; right:4px; width:137px; height:15px;
pointer-events:none; z-index:1` with `opacity="0.75"` — that is exactly
`ChartWatermark`'s existing `inset={4}` branch. Pass `inset={4}` (the scatter
cards use the default `12`/0.65). No change to `icons.tsx`.

**Chart scroll wrapper** className verbatim (note this differs from the scatter
card's `relative mt-2 overflow-x-scroll 2xl:overflow-visible`):
```
overflow-x-scroll pl-4 -ml-4 2xl:overflow-visible 2xl:pl-0 2xl:ml-0
```

---

## 2. `ChartNotes`

```tsx
export type ChartNote = { title: string; body: React.ReactNode };
export function ChartNotes(props: { notes: ChartNote[] }): React.ReactElement
```

Measured (from the `benchmark-score-by-eval` tab, before and after clicking
«1 more note»):

```
div                                    ← no className
└── div                                ← no className
    ├── <MetricAccordion title={notes[0].title}>{notes[0].body}</MetricAccordion>
    ├── … one per revealed note
    └── {hidden > 0 && (
          <button type="button"
            className="w-full flex items-center gap-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <Plus className="h-3 w-3 shrink-0" />
            <span>{`${hidden} more note${hidden === 1 ? "" : "s"}`}</span>
          </button>
        )}
```

- Only `notes[0]` is visible initially; the rest are hidden behind the button.
  Clicking it reveals **all** remaining notes and the button disappears
  (verified: after the click the button was gone and both accordions were
  present, each `data-state="closed"`).
- Take the revealed/hidden state in `useState(false)`; one-way (the target offers
  no way to re-collapse).
- Each note is its own single-item `MetricAccordion`, closed by default,
  measuring h 37 (trigger 29 + `mb-2`).
- **Measured difference between the first note and the rest:** the first note's
  Radix `AccordionItem` carries `className="border-none"`; the revealed ones
  carry **no** className. `MetricAccordion` as built hard-codes `border-none`.
  Since `border-none` only removes a border that Radix never adds, this is a
  no-op visually — reuse `MetricAccordion` unchanged for every note and note the
  deviation in your report rather than editing `chart-card.tsx` for it.
- The target renders the lucide-shaped info glyph as a **Radix 15×15
  `InfoCircledIcon`** (`<svg width="15" height="15" viewBox="0 0 15 15" class="h-3 w-3 shrink-0">`),
  whereas `MetricAccordion` uses lucide `Info` at `h-3 w-3`. Both render 12×12
  and are visually equivalent — leave it, and note it.
- The button text `<span>` is preceded by a literal space in the target's HTML
  (`</svg> <span>`); JSX whitespace between the two elements reproduces it.

---

## 3. `ChartEmptyState`

Our run has no token/turn/percentile/harness telemetry, so 10 of the 19 tabs
cannot be populated. Per the product decision, keep the card and chrome
pixel-identical and put a message where the chart would be.

```tsx
export function ChartEmptyState(props: {
  height?: number;   // default 320 — the ResponsiveContainer height it replaces
  reason: string;
}): React.ReactElement
```

```tsx
<div className="flex w-full flex-col items-center justify-center gap-2 text-center"
     style={{ height }}>
  <p className="text-sm text-neutral-500">Not measured in this run</p>
  <p className="max-w-[52ch] text-xs text-neutral-400">{reason}</p>
</div>
```

Height must match the chart it stands in for so section heights stay faithful:
**320** for the wide bar charts, **384** for the scatter charts. Add no border,
no background, no icon — anything else would invent chrome the target does not
have.

---

## 4. `ChartCardHeader` amendment (the ONLY permitted edit to `chart-card.tsx`)

Measured, at 1440:

| tab | header height | right column |
|---|---|---|
| `index` | **112** | 3 icon buttons (32) + gap 8 + `lg:flex-col` stack: Color-by row (36) + gap 8 + combobox row (32) = 76 |
| `benchmark-score-by-eval` | **72** | 3 icon buttons (32) + gap 8 + combobox row (32) |
| all 4 `harness-comparison` tabs | **72** | 3 icon buttons (32) — **and nothing else** |

So the 40px delta between the first two is entirely the "Color by" toggle plus
its `lg:flex-col` wrapper. Add two optional props, defaulting to today's
behaviour so no existing call site changes:

```tsx
export function ChartCardHeader({
  title, caption,
  showColorBy = true,
  showModelPicker = true,
  modelCount = "21 of 21 models",
}: {
  title: string;
  caption: React.ReactNode;
  showColorBy?: boolean;
  showModelPicker?: boolean;
  modelCount?: string;
})
```

- `showColorBy === true` → today's markup, unchanged.
- `showColorBy === false` → the second row becomes, verbatim (measured
  `div.flex flex-wrap justify-end gap-1 hide-during-screenshot > div.flex gap-1`,
  box `1072,1455,316,32`):
  ```
  div.flex.flex-wrap.justify-end.gap-1.hide-during-screenshot
  └── div.flex.gap-1
      ├── div.w-auto.min-w-[11rem].sm:w-[280px] > button[role=combobox]…
      └── button[aria-label="Open chart display settings"]…
  ```
  i.e. the existing combobox + settings pair, but **without** the
  `div.flex.items-center.justify-end.gap-1.lg:flex-col.lg:items-end.lg:gap-2.lg:-mt-1`
  wrapper and without the «Color by» `span` + `div[role=group]`.
- `modelCount` replaces the hard-coded combobox `span.truncate` text. The target
  ships `21 of 21 models` on the `index` tab and `15 of 52 models` on
  `benchmark-score-by-eval` (it counts *its* rows, not ours) — Phase 4 will pass
  our own counts.

### 4a. Third variant: `showModelPicker === false` (measured 2026-08-02)

Measured over all 19 tabs (`docs/research/_harness-header.json`,
`_tab-colorby.json`): the four `harness-comparison` tabs ship **no combobox row at
all**. `comboboxCount === 0` and the right column contains only

```
div.flex.items-center.justify-end.gap-1.hide-during-screenshot   (the 3 icon buttons)
```

The entire `div.flex.flex-wrap.justify-end.gap-1.hide-during-screenshot` second row
is absent from the DOM — not hidden, absent. Header height is still **72**, but for
a different reason than `benchmark-score-by-eval`: here 72 is driven by the *left*
column (h3 28 + gap 4 + caption `min-h-[2.5rem]` 40), because the right column is
only 32 tall.

So `showModelPicker === false` → render the first row (icon buttons) and omit the
second row entirely. It composes with `showColorBy`, but only one combination
occurs on the target: all four harness tabs are `showColorBy: false,
showModelPicker: false`.

Measured `showColorBy` for all 19 tabs is recorded in
`docs/research/_tab-colorby.json`; it is `false` on exactly the multi-series tabs
(`benchmark-score-by-eval`, `token-usage`, `tokens-by-benchmark`) and all four
harness tabs.

Change nothing else in `chart-card.tsx`: not `ChartCard`, not `MetricAccordion`,
not any class string, not `INDICATOR_INSET`.

---

## Constraints

- Create only `src/components/chart-panel.tsx` and
  `src/components/chart-empty-state.tsx`.
- Amend only `ChartCardHeader` in `chart-card.tsx`, exactly as in §4.
- Do not touch `globals.css`, `icons.tsx`, `page.tsx`, `layout.tsx`,
  `leaderboard.ts`, `ui/tabs.tsx`, `ui/accordion.tsx`, any chart component, or
  any other existing file. Do not create route files.
- Run `npx tsc --noEmit` from `app/site` and report the result.

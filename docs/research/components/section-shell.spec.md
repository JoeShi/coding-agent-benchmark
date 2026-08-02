# Component spec: section shell (header + chart card + controls + accordion)

Every one of the 5 main-grid sections is built from the same four pieces. Build
them once here; the 5 sections then differ only in copy + which chart they embed.

## Files to create (create ONLY these)

| file | exports |
|---|---|
| `src/components/section-header.tsx` | `SectionHeader` |
| `src/components/chart-card.tsx` | `ChartCard`, `ChartCardHeader`, `MetricAccordion` |
| `src/components/ui/tabs.tsx` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| `src/components/ui/accordion.tsx` | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |

All four are `"use client"`. `@radix-ui/react-tabs` and
`@radix-ui/react-accordion` are already installed. Follow `src/components/ui/tooltip.tsx`
for the shadcn wrapper style already used in this repo.

> Read `app/site/AGENTS.md` first — this is Next 16 / Tailwind v4, not the
> Next.js you know. Tailwind v4 has **no `container` plugin** and preflight
> defaults `border-color` to `currentColor`, so a bare `border` renders BLACK.
> Every measured `1px solid rgb(217,217,217)` border must be written
> `border border-border`; every measured `rgb(231,231,231)` border must be
> `border-neutral-100`. Verified by the highlights builder.

---

## 1. `SectionHeader`

```tsx
export function SectionHeader(props: { id: string; title: string; children: React.ReactNode })
```

Renders the `<section>` element itself plus its header block. `children` is the
section body.

```
section#{id}.scroll-mt-24
├── div.flex.flex-col.gap-4.mb-8.pt-5.border-t.border-border          ← header
│   ├── div.h-px.w-px.opacity-0.pointer-events-none                   (scroll-spy sentinel, 1×1)
│   ├── div.flex.items-start.justify-between.gap-4                    (h 36; holds ONLY the h2)
│   │   └── h2.flex.items-baseline.gap-3.flex-wrap
│   │       ├── span.w-5.h-5.bg-black                                 (20×20 swatch)
│   │       └── span                                                  {title}
│   └── p.text-base.max-w-[60ch]                                      {description}
└── div.flex.flex-col.gap-8.overflow-hidden                           {children}
```

Computed (verified): header `padding 20px 0 0`, `margin 0 0 32px`, `gap 16px`,
`border-top 1px solid rgb(217,217,217)`. `h2` 30px/36px weight 400 serif — the
global `h2` rule in `globals.css` already supplies family + size, so add **no**
font utilities. `p` 16px/24px, `max-width 634.219px` (that is what `60ch` yields).

Take `title` and `description` as props; do not hard-code the 5 sections here.

---

## 2. `ui/tabs.tsx`

Thin shadcn-style wrappers over Radix Tabs, **no default classes of their own** —
the call sites pass the full verbatim class strings (below). Just forward
`className` through `cn()` and spread props, mirroring `ui/tooltip.tsx`.
`TabsContent` must render `data-state` (Radix does this) and must NOT use
`forceMount`: on the target every inactive panel measures `[0,0,0,0]`, i.e. Radix
unmounts them.

---

## 3. `ChartCard`

```tsx
export function ChartCard(props: {
  tabs: { value: string; label: string }[];
  defaultValue?: string;
  children: (active: string) => React.ReactNode;   // panel body for the active tab
})
```

```
div.scroll-mt-24.border.border-border.rounded-lg                      [w 1149.5]
├── div.w-full.overflow-x-auto.border-b.border-border.py-3.bg-neutral-50.px-1.light-scrollbar.rounded-t-lg   (h 61)
│   └── div[role=tablist]   (h 36, x = card.x + 5)
│       ├── button[role=tab] × n
│       └── div  ← sliding indicator, LAST child
└── div[role=tabpanel][data-state=active].mt-0.p-4                    (only the active one exists)
    └── {children(active)}
```

Tablist className, verbatim:
```
h-9 rounded-lg bg-brand-blue-light p-1 text-neutral-500 relative min-w-full !bg-transparent !p-0 !rounded-none !border-0 !shadow-none !h-auto justify-start inline-flex items-center
```

Tab trigger className, verbatim:
```
justify-center rounded px-3 font-medium ring-offset-background data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center whitespace-nowrap text-sm gap-2 text-neutral-700 data-[state=active]:!text-black z-10 !rounded-none pl-6 pr-6 py-2 !bg-transparent data-[state=active]:!bg-transparent data-[state=active]:!shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
```
(Tailwind v4.3 still accepts the leading-`!` important form — already verified by
the site-nav builder. Do **not** run these through `twMerge`/`cn()`: it silently
drops classes the target ships. Use plain string concatenation.)

Indicator className: `absolute bg-neutral-100 pointer-events-none rounded ease-out`
(computed `background rgb(231,231,231)`, `border-radius 4px`).

Indicator inline style, verbatim — only `left`/`width` are dynamic:
```ts
{
  left: `${left}px`, width: `${width}px`, height: "36px", top: "0px",
  transitionProperty: "left, width, height, top",
  transitionDuration: "280ms",
  transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
  transform: "translateZ(0px)",
  willChange: "left, width, height, top",
  backfaceVisibility: "hidden",
}
```

**Positioning rule (measured, do not estimate):**
`left = activeTab.offsetLeft + 12`, `width = activeTab.offsetWidth − 24`.
Cross-check: tab «Index» is `offsetWidth 84.02` → indicator width `60.02`, and
the tablist starts at x 261 while the indicator starts at x 273. The ±12 is the
trigger's `pl-6 pr-6`. Measure with `offsetLeft`/`offsetWidth` inside a
`useLayoutEffect` keyed on the active value, storing refs in an array.

Panel className, verbatim: `mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 p-4`

---

## 4. `ChartCardHeader`

The controls row. Identical in the tabbed cards and the `p-8` scatter cards.

```tsx
export function ChartCardHeader(props: { title: string; caption: React.ReactNode })
```

```
div.grid.grid-cols-12.gap-6.xl:gap-12                                  (h 112)
├── div.col-span-12.sm:col-span-7.xl:col-span-8.flex.flex-col.gap-1
│   ├── h3.text-xl.font-brand-serif  →  <span>{title}</span>           (20px/28px w400)
│   └── div.text-xs.text-neutral-500.inline-flex.items-baseline.gap-0.max-w-[60ch]
│       └── span[style="text-wrap:pretty"] → span.block.min-h-[2.5rem]  {caption}
└── div.col-span-12.sm:col-span-5.xl:col-span-4.flex.flex-col.gap-2
    ├── div.flex.items-center.justify-end.gap-1.hide-during-screenshot   ← 3 icon buttons
    └── div.flex.flex-wrap.justify-end.gap-1.hide-during-screenshot
        └── div.flex.items-center.justify-end.gap-1.lg:flex-col.lg:items-end.lg:gap-2.lg:-mt-1
            ├── div.flex.items-center.gap-1                              ← "Color by" toggle
            └── div.flex.gap-1                                           ← combobox + settings
```

Caption is 12px/16px `rgb(148,148,148)`.

**3 icon buttons** — 32×32, `aria-label` in order `Copy link to this section`,
`Download chart as image`, `Download data`; lucide `Link2`, `ImageDown`, `Table`.
Shared className verbatim:
```
inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 rounded-lg leading-none border border-neutral-100 bg-white text-black hover:border-neutral-700 h-8 w-8
```
They are decorative in this clone — render as `<button type="button">` with no
onClick. Do not implement download/copy.

**"Color by" toggle** — `span.hidden.whitespace-nowrap.text-xs.text-neutral-600.sm:inline`
«Color by», then `div[role=group].flex.items-center.justify-center.gap-1.rounded.bg-brand-blue-light.p-0.5`
with inline `style={{ outline: "none" }}` (128.74×36) holding two
`button[role=radio]` «Model» (`data-state="on"`) and «Agent» (`data-state="off"`).
Radio className verbatim:
```
inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 bg-transparent hover:bg-accent hover:text-accent-foreground min-w-9 h-8 rounded border border-neutral-100 px-2 text-xs shadow-none data-[state=on]:bg-background data-[state=on]:text-foreground sm:px-3
```
Hold the on/off value in local `useState<"Model"|"Agent">("Model")` and drive
`data-state`. It does not need to change the chart.

**Combobox + settings** — `div.w-auto.min-w-[11rem].sm:w-[280px]` wrapping
`button[role=combobox][data-state=closed]` with className
```
inline-flex items-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 rounded-lg leading-none border border-neutral-100 bg-brand-blue-light text-black hover:border-neutral-700 h-8 px-3 py-2 w-full justify-between
```
containing `span.truncate` with text `21 of 21 models` and a lucide
`ChevronsUpDown` (`h-4 w-4`). Then a 32×32 `button` with
`aria-label="Open chart display settings"`, className = the 3-icon-button string
above plus `relative`, containing a lucide `SlidersHorizontal` (`w-4 h-4`) and
```
span.absolute.-top-1.5.-right-1.5.rounded-full.bg-brand-purple-dark.px-[4px].py-[3px].text-[7px].leading-none.text-white
```
with text `NEW`. Both are non-functional in this clone.

---

## 5. `MetricAccordion`

```tsx
export function MetricAccordion(props: { title: string; children: React.ReactNode })
```

Single-item Radix accordion, `type="single"` `collapsible`, closed by default.

```
div.w-full.text-sm
└── AccordionItem  value="x"  className="border-none"
    ├── AccordionTrigger  (rendered inside an h3 by Radix)
    │   ├── div.flex.items-center.gap-1  →  <Info className="h-3 w-3 shrink-0"/> + <span>{title}</span>
    │   └── <Plus className="h-4 w-4 shrink-0 transition-transform duration-200 text-neutral-600"/>
    └── AccordionContent
        └── div.pt-0.hide-during-screenshot.text-xs.[&_a]:underline.pb-2
            └── div.space-y-2  {children}
```

Trigger className verbatim:
```
flex flex-1 items-center justify-between [&[data-state=open]>svg]:rotate-45 text-xs text-left font-normal text-muted-foreground border-b border-neutral-100 py-1.5 mb-2 transition-colors hover:text-foreground hover:no-underline
```
Computed: 12px/16px, `color rgb(120,120,120)`, `padding 6px 0`, `margin 0 0 8px`,
`border-bottom 1px solid rgb(231,231,231)`, height 29. The `[&[data-state=open]>svg]:rotate-45`
turns the `Plus` into an ×, so use `Plus` (not `ChevronDown`) and do not add your
own rotation.

`AccordionContent` className: `overflow-hidden transition-all duration-300 text-sm`
plus the standard shadcn `data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down`.
Those two keyframes do **not** exist in `globals.css` and you must not edit
`globals.css` — instead rely on Radix's `--radix-accordion-content-height` with
plain `max-h` transitions, i.e. use exactly:
`overflow-hidden transition-all duration-300 text-sm data-[state=closed]:max-h-0 data-[state=open]:max-h-[var(--radix-accordion-content-height)]`.

Children are `<p>` elements supplied by the call site (12px/16px via the
`text-xs` wrapper).

---

## Constraints

- Do not create or modify any file other than the four listed above.
- Do not touch `globals.css`, `page.tsx`, `layout.tsx`, `leaderboard.ts`, or any
  existing component.
- No chart code here — charts arrive as `children`.
- Run `npx tsc --noEmit` from `app/site` and report the result.

# Component spec — Floating Nav

**Target file:** `app/site/src/components/site-nav.tsx`
**Export:** `export function SiteNav()`
**Directive:** `"use client"` (needs hover state for the sliding indicator).
All CSS below is `getComputedStyle()` output at viewport 1440 (desktop) / 390 (mobile). Do not estimate.

## INTERACTION MODEL

- **No scroll state.** Verified: computed styles at scrollY 0 and 4000 are byte-identical. The nav is a constant floating pill. Do **not** add a scrolled/shrunk/shadow variant.
- **Sliding black indicator** per pill group, moved by JS on `pointerenter` of each item.
- **Mega-menu dropdowns are OUT OF SCOPE** (deliberate deviation — each of the 6 panels is a 1385×740 directory listing ~13 KB of unrelated site content). Consequence: since there is no open state, drive the indicator's `opacity` from **hover** instead of `data-state="open"`. Everything else about the indicator is verbatim. Render the triggers as plain `<button type="button">` with no `aria-expanded` / `aria-haspopup`.

## Structure

```
div.z-50.w-full.sticky.top-6.-mb-9            ← wrapper, box [0,24,1425,36]
├── div.container.xl:hidden                   ← mobile bar
└── div.container.hidden.xl:block             ← desktop pill
    └── nav[aria-label="Main"].relative.flex-1.w-full.max-w-none.z-50.flex.items-stretch.justify-between
        ├── a[href="/"]                       ← brand pill
        ├── div.relative                      ← 3 pill groups
        └── div.flex.items-center.gap-1       ← right cluster
```

Wrapper computed: `position:sticky; top:24px; z-index:50; margin:0 0 -36px; width:100%; height:36px; display:block`.
Note: the target also puts a `dark` class on `nav[aria-label="Main"]` — it is **inert** (tokens inside it are identical to `body`). **Omit it.**

## Desktop (`xl:` = 1280px and up)

**Brand pill** — `a[href="/"]` classes verbatim:
`flex-shrink-0 flex items-center select-none gap-2 px-3 bg-black rounded-full self-stretch`
Computed: `bg rgb(0,0,0)`, `padding 0 12px`, `border-radius 9999px`, `gap 8px`, height 36, width 171.59.
Children: `<AaLogoIcon className="h-4 w-4 text-white" />` (from `@/components/icons`, 16×16, `color rgb(255,255,255)`), then
`<span className="font-brand-serif text-white hidden sm:block whitespace-nowrap">Artificial Analysis</span>` — 16px/24px.

**Pill groups** — `div.flex.items-center.relative` (this is the positioning context for all indicators), containing 3 groups.
Every group: `div.bg-neutral-100.rounded-[1.5rem].[clip-path:inset(0_round_1.5rem)]` → `bg rgb(231,231,231)`, `border-radius 24px`, height 36. Group 0 additionally has `flex items-center`. Group gap comes from the parent `ul` — use `gap-0` on the `ul` and let the groups sit adjacent; measured x/width: group0 285/619, group1 904/84, group2 988/93 (i.e. touching, no gap).
Wrap the groups in `ul.group.flex-1.list-none.justify-center.flex.items-center.gap-0`.

Each item is `li.z-10` wrapping a trigger with these classes verbatim:
```
inline-flex w-max items-center justify-center rounded-3xl px-3 py-2 text-sm
transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50
bg-transparent hover:bg-transparent hover:text-white
focus-visible:bg-black focus-visible:text-white
```
Computed: `font-size 14px`, `color rgb(0,0,0)`, `padding 8px 12px`, `border-radius 24px`.

Items, in order (label → group, measured width for reference only — do not hard-code widths):
- Group 0 (`<button>`): `Models` 72, `Coding Agents` 120, `Speech, Image, Video` 165, `Inference` 85, `Leaderboards` 115, `About` 63
- Group 1 (`<a href="/trends">`): `AI Trends` 84
- Group 2 (`<button>`): `Arenas` 93

**Indicator** — one per group, as the group's last child:
`div.absolute.top-0.bottom-0.rounded-3xl.bg-black.pointer-events-none.-z-[1]`
Inline style, exactly: `left: <px>; width: <px>; opacity: <0|1>; transition: left 280ms ease-out, width 280ms ease-out, opacity 280ms ease-out;`
- `left` / `width` = hovered item's `offsetLeft` / `offsetWidth` **relative to the shared `div.relative` wrapper** (not the group). Measured proof: hovering `Coding Agents` (page x 357) yielded `left: 71.9609px; width: 119.922px` with the wrapper at x 285.
- All three groups render the same `left`/`width`/`opacity`; each group's `clip-path` crops it to that group's rounded rect. This is how one indicator appears to travel between separate pills.
- Rest state: `opacity: 0`, and `left`/`width` retained from the last hover (initialise to the active item — `Coding Agents`).
- On `pointerenter` of any item in any group: set `left`/`width` to that item, `opacity: 1`. On `pointerleave` of the shared wrapper: `opacity: 0`, keep `left`/`width`.
- Measure with `getBoundingClientRect()` against the wrapper ref inside a `useLayoutEffect` for the initial value (so the resting position is correct before first hover) and in the `pointerenter` handler thereafter.

**Right cluster** — `div.flex.items-center.gap-1` (gap 4px), children in order.

The target derives 4 of these from one shadcn `Button` cva. Declare it once and reuse:
```ts
const BTN_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 rounded-lg leading-none";
```

1. `div.flex.items-center.gap-2` → `a[href="/pricing?source=nav&from=%2Fagents%2Fcoding-agents"]` `Premium`, classes verbatim (does **not** use `BTN_BASE`):
   ```
   inline-flex h-9 w-fit flex-none items-center justify-center whitespace-nowrap rounded-lg px-3
   text-sm text-white transition-colors bg-brand-purple-dark shadow-sm
   hover:bg-brand-purple-dark/90 active:bg-brand-purple-dark/75 focus-visible:outline-none
   focus-visible:ring-2 focus-visible:ring-brand-purple-dark/50 focus-visible:ring-offset-2
   focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50
   ```
   Computed `bg rgb(116,26,102)`, `font-size 14px`, `line-height 20px`, `padding 0 12px`, `border-radius 8px`, `box-shadow rgba(0,0,0,0.05) 0 1px 2px 0`, 82×36.
2. `a[href="/login"][aria-label="Log in"]` `Log in` — `BTN_BASE` + verbatim:
   `bg-black text-white hover:bg-neutral-700 h-9 px-3 py-2 flex-none flex items-center justify-center overflow-hidden !rounded-lg w-fit !transition-[width,border-radius] ease-out motion-reduce:transition-none !duration-300`.
   Computed `padding 8px 12px`, `line-height 14px`, `border-radius 8px`, 63×36, `transition: width .3s cubic-bezier(.4,0,.2,1), border-radius .3s cubic-bezier(.4,0,.2,1)`.
3. Search `button` — `BTN_BASE` + `bg-neutral-100 hover:bg-neutral-200 h-9 w-9 2xl:w-auto 2xl:px-3`. Contains `<Search />` then `<span className="hidden 2xl:inline-flex gap-0.5 items-center text-neutral-700"><Command className="!w-3 !h-3" />K</span>`. Computed `bg rgb(231,231,231)`, 36×36, `border-radius 8px`.
4. Social trigger `button[aria-label="Social links"]` — `BTN_BASE` + `bg-neutral-100 hover:bg-neutral-200 text-neutral-500 h-9 w-9 2xl:hidden`. Contains `<Share2 />`. Computed `color rgb(148,148,148)`.
5. `div.hidden.items-center.gap-1.2xl:flex` with three `a[target="_blank"] rel="noreferrer"`, each `BTN_BASE` + `bg-neutral-100 text-neutral-500 h-9 w-9 duration-200`:
   - X → `https://x.com/ArtificialAnlys`, `hover:text-black`, icon `<TwitterLogoIcon className="w-4 h-4" />` from `@radix-ui/react-icons`
   - LinkedIn → `https://www.linkedin.com/company/artificial-analysis/`, `hover:text-[#0A66C2]`, icon `<LinkedInLogoIcon className="w-4 h-4" />`
   - YouTube → `https://www.youtube.com/@ArtificialAnalysisAI`, `hover:text-[#FF0033]`, icon `<YouTubeIcon className="w-4 h-4" />` from `@/components/icons`

`Search`, `Command`, `Share2`, `Menu` come from `lucide-react`.

## Mobile bar (`xl:hidden`, measured at 390)

`div.container.xl:hidden` → `div.flex.items-center.justify-between.gap-2` (gap 8px, height 36):
1. The **same brand pill markup** as desktop. At 390 the label `span` is `hidden sm:block` → `display:none`, so the pill collapses to 40×36 (icon + 12px side padding).
2. `div.min-w-0.flex.items-center.gap-1` (gap 4px) with, in order:
   - `div.flex.items-center.gap-2` → the **same `Premium` link** as desktop item 1 (verified present at 390: box [141,24,82,36]).
   - `a[href="/login"][aria-label="Log in"]` `Log in` — identical to desktop item 2, box [227,24,63,36].
   - Search `button` — identical to desktop item 3, box [294,24,36,36] (the `K` span stays `hidden` below 2xl).
   - Menu `button` — `BTN_BASE` + `bg-neutral-100 hover:bg-neutral-200 h-9 w-9`, containing `<Menu />`. Box [334,24,36,36].

There is **no** social trigger and **no** social cluster in the mobile bar.

The search / social / menu buttons are non-functional in the clone (no dialogs) — keep them as inert `<button type="button">` so hover states still read correctly.

## Acceptance

- `npx tsc --noEmit` passes.
- At 1440 the nav row measures 36px tall, starts at y=24, brand pill x=20, right cluster ends at x=1405.
- Hovering any pill slides the black indicator under it in 280ms `ease-out` and turns that label white; leaving the group fades the indicator out.
- At 390 only brand + Log in + search + menu are visible; at 1280 the desktop pill replaces the mobile bar; at 1536 the three social links appear and the search button widens to show `⌘K`.

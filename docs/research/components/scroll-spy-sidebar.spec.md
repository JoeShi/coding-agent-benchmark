# Component spec — Scroll-spy Sidebar

Source: `artificialanalysis.ai/agents/coding-agents`
Measured at `1440x900x2`, `clientWidth = 1425`. All values from `getComputedStyle()`.

## INTERACTION MODEL

**Scroll-driven anchor spy. NOT tabs.** Clicking an item smooth-scrolls to a section;
it does **not** swap content. All five target sections are always mounted and visible.

- Items are `<a href="#…">`.
- Active item carries `aria-current="location"`.
- Navigation is native: `html { scroll-behavior: smooth }` + `scroll-mt-24` on targets.
- **Do not intercept the click.** Use `IntersectionObserver` only to compute which item
  gets `aria-current`.

Verified by sampling active state at `scrollY` 0 / 679 / 2112 / 3887 — the active item
advanced on its own with zero clicks issued.

## Placement in the page layout

```
div.grid.grid-cols-12.gap-7                 w=1385  x=20  h=6427   gap 28px
├── div.hidden.lg:block.col-span-2          w=208   x=20  h=6427   ← sidebar holder
│   └── div.pt-5.border-t.sticky.top-24.z-30  w=208  h=149
│       └── div.flex.flex-col.gap-3
│           └── a.group.flex.gap-2  ×5      w=208  h=16
└── div.col-span-full.lg:col-span-10.flex.flex-col.gap-16   w=1150  x=256  h=6427
```

Grid columns at 1425: 12 × `89.75px`, gap `28px`.

## Sticky container

| Property | Value |
|---|---|
| classes | `pt-5 border-t sticky top-24 z-30` |
| `position` | `sticky` |
| `top` | `96px` |
| `padding-top` | `20px` |
| `border-top` | `1px solid rgb(217, 217, 217)` |
| `z-index` | `30` |
| height | `149px` |
| visibility | `hidden lg:block` → **only at ≥1024px** |

Inner list: `flex flex-col gap-3` → `gap: 12px`.
Item stride = 16px height + 12px gap = **28px** (verified: item y = 1212, 1240, 1268, 1296, 1324).

## Items

Each item: `<a class="group flex gap-2" href="…">` — `display: flex`, `gap: 8px`,
`w: 207.5px`, `h: 16px`, `padding: 0`, `transition: all`.

| Order | Label | href |
|---|---|---|
| 1 | `Performance` | `#coding-agents-index` |
| 2 | `Harness Comparison` | `#harness-comparison` |
| 3 | `Token Usage` | `#token-usage` |
| 4 | `Cost` | `#cost-to-run` |
| 5 | `Execution Time` | `#execution-time` |

> Labels deliberately differ from the anchor ids — `Performance` → `#coding-agents-index`,
> `Cost` → `#cost-to-run`. Do not "fix" these to match.

Each item has exactly two children:

**1. Dot** — `<span class="h-2 w-2 flex-shrink-0 transition-colors mt-1 …">`
- `8px × 8px`, `margin-top: 4px`, `flex: 0 0 auto`
- **`border-radius: 0px` — it is a SQUARE, not a circle.**

**2. Label** — `<span class="text-xs group-hover:opacity-100 transition-colors …">`
- `text-xs` → `font-size: 12px`, `line-height: 16px`
- `font-family: suisseIntl`, `font-weight: 400`, `color: rgb(0, 0, 0)`

## STATES (all three required)

| State | Dot class / colour | Label class / opacity |
|---|---|---|
| **Active** (`aria-current="location"`) | `bg-black` → `rgb(0, 0, 0)` | *(no opacity class)* → `opacity: 1` |
| **Inactive** | `bg-neutral-500` → `rgb(148, 148, 148)` | `opacity-50` → `opacity: 0.5` |
| **Hover (inactive)** | unchanged | `group-hover:opacity-100` → `opacity: 1` |

Hover is driven off the parent `.group`, so hovering anywhere on the link raises the label.

**Transition** (on both dot and label, from `transition-colors`):
```
color, background-color, border-color, text-decoration-color, fill, stroke
0.15s cubic-bezier(0.4, 0, 0.2, 1)
```
Note the label's opacity change is **not** in the transition list — `transition-colors`
only covers colour properties, so opacity snaps. Reproduce that exactly; do not add
`transition-opacity`.

## Responsive

| Width | Behaviour |
|---|---|
| ≥1024px (`lg`) | visible, sticky, 208px wide, `col-span-2` |
| <1024px | holder is `display: none`; main column becomes `col-span-full` |

No mobile drawer/accordion replacement — the sidebar simply disappears.

## Clone notes

- Render from the `benchmarks` + section list; keep label/href pairs hard-coded as above.
- `IntersectionObserver` with a root margin that matches `top-24` (96px) so the active
  item flips as a section clears the sticky nav.
- Target sections must each carry `scroll-mt-24` (`scroll-margin-top: 96px`).

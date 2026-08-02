# Component spec — Back-to-top button

Source: `artificialanalysis.ai/agents/coding-agents`
Measured at `1440×900`, `clientWidth = 1425`, 2026-08-02.
Raw artifacts: `docs/research/_floating.json` (fixed-element sweep),
`docs/research/_backtotop.json` (per-scroll states + full computed detail).

> **This is the only `position: fixed` element on the page.** A sweep of every
> visible element at `scrollY 1200` returned exactly one hit. An earlier note in
> this repo claimed there was also a floating *share* button — there is not.

## INTERACTION MODEL

Scroll-position driven visibility, then a scroll-to-top on click.

- Hidden while `scrollY <= 400`, shown while `scrollY > 400`. Measured by bisection:
  `380 → hidden`, `400 → hidden`, `420 → shown`, and shown at every larger offset
  up to 4000. So the predicate is a strict `> 400`, not `>=`.
- **It is never unmounted.** At `scrollY 0` the button is still in the DOM with
  `visibility: visible`; only `opacity`, `transform` and `pointer-events` change.
  Do not gate it behind a conditional render — that would drop the 300ms fade.
- The page sets `html { scroll-behavior: smooth }` (confirmed via
  `getComputedStyle(document.documentElement).scrollBehavior === "smooth"`; our
  `globals.css:136-137` already ships it). A plain `window.scrollTo({ top: 0 })`
  therefore animates on its own — do **not** pass `behavior: "smooth"` explicitly
  and do **not** pass `behavior: "instant"`.

## Placement

Direct child of `main.min-h-screen`, third of five, i.e. **after** the `div.pb-40`
content wrapper and **before** the footer:

```
main.min-h-screen
├── div.z-50.w-full.sticky.top-6.-mb-9        ← site nav
├── div.pb-40                                 ← all page content
├── button[aria-label="Back to top"]          ← THIS COMPONENT
├── section                                   ← empty: no class, no children, h 0
└── footer.relative.mt-auto.bg-brand-purple-light.text-brand-plum
```

The empty `<section>` measured `[x 0, w 1425, h 0]`, `display: block`, no padding,
margin or background, `innerText === ""`, `children.length === 0` — a mount
placeholder. Rendering it is a visual no-op; keep it only for DOM fidelity.

Note the footer is **inside** `main`, which is what makes its `mt-auto` resolve
against `main.min-h-screen`.

## Classes

Base string, verbatim from `outerHTML` (do **not** route through `cn()`/`twMerge`):

```
inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 leading-none border text-black hover:border-neutral-700 fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full shadow-lg transition-all duration-300 bg-background hover:bg-neutral-100 border-neutral-300
```

State suffix, appended to the above:

| State | Appended classes | Measured |
|---|---|---|
| hidden (`scrollY <= 400`) | `translate-y-4 opacity-0 pointer-events-none` | box `[1361, 852, 40, 40]`, `opacity 0`, `matrix(1, 0, 0, 1, 0, 16)`, `pointer-events: none` |
| shown (`scrollY > 400`) | `translate-y-0 opacity-100` | box `[1361, 836, 40, 40]`, `opacity 1`, `matrix(1, 0, 0, 1, 0, 0)`, `pointer-events: auto` |

The 16px box delta between the two states is the `translate-y-4`, not a layout
change — `bottom` stays `24px`.

## Computed values (shown state)

| Property | Value |
|---|---|
| `position` | `fixed` |
| `bottom` / `right` | `24px` / `24px` |
| `z-index` | `50` |
| `width` × `height` | `40px` × `40px` |
| `border-radius` | `9999px` |
| `background-color` | `rgb(255, 255, 255)` |
| `color` | `rgb(0, 0, 0)` |
| `border` | `1px solid rgb(212, 212, 212)` |
| `box-shadow` | `rgba(0,0,0,0.1) 0 10px 15px -3px, rgba(0,0,0,0.1) 0 4px 6px -4px` (`shadow-lg`) |
| `transition` | `0.3s cubic-bezier(0.4, 0, 0.2, 1)` (`transition-all duration-300`, default ease) |
| `display` / `align-items` / `justify-content` / `gap` | `flex` / `center` / `center` / `8px` |
| `font-size` / `line-height` | `14px` / `14px` (`text-sm leading-none`) |

### `border-neutral-300` needs a token added to `globals.css`

The target's own `--neutral-300` and `--neutral-400` custom properties are **empty
strings** — it never defines them, so its `border-neutral-300` falls through to
Tailwind's stock `neutral-300` = `#d4d4d4` = `rgb(212, 212, 212)`, which is exactly
what was measured.

Our `globals.css` overrides the `neutral` namespace through `@theme inline`
(`--color-neutral-*`) and defines 50/100/200/400/500/600/700/900 but **not 300**.
Under Tailwind v4 the missing key would fall back to the default
`oklch(0.87 0 0)` — visually the same colour, but `getComputedStyle` would report
`oklch(...)` instead of `rgb(212, 212, 212)`, which breaks the Phase 5 diff.

So add the one missing rung, following exactly the pattern `--neutral-400` already
sets (Tailwind's default hex converted to a bare HSL triplet):

```css
  --neutral-300: 0 0% 83.14%;   /* #d4d4d4 — 212/255 */
```
plus `--color-neutral-300: hsl(var(--neutral-300));` in the `@theme inline` block.

This is a foundation completion, not a deviation: it makes a measured value exact.

## Icon

lucide `ArrowUp`, `className="h-5 w-5"`, `aria-hidden="true"`:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
     stroke-linejoin="round" class="lucide lucide-arrow-up h-5 w-5" aria-hidden="true">
  <path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path>
</svg>
```

**It renders 16×16, not 20×20** — measured `svgCS` is `width: 16px, height: 16px`.
The button's `[&_svg]:w-4 [&_svg]:h-4` compiles to a descendant selector
(`.\[\&_svg\]\:h-4 svg`, specificity 0,1,1) which out-specifies the icon's own
`.h-5` (0,1,0). Keep **both** — writing `h-4 w-4` on the icon would render the same
16px but stop matching the target's markup.

`stroke` resolves to `rgb(0, 0, 0)` from the button's `text-black` via
`stroke="currentColor"`.

## Accessibility

`aria-label="Back to top"` on the button; the svg is `aria-hidden`. There is no
visible text and no tooltip.

## Constraints

- Create only `src/components/back-to-top.tsx` (`"use client"` — it needs a scroll
  listener).
- Amend `globals.css` only to add the `--neutral-300` / `--color-neutral-300` pair
  described above. Change nothing else in it.
- Do not create route files. Do not touch any other component.

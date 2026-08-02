# Component spec: `SiteFooter`

The purple footer at the very bottom of the page. Measured at 1440 (`1425 × 676`
including its own bottom bar).

## Files to create (create ONLY these)

| file | exports |
|---|---|
| `src/components/site-footer.tsx` | `SiteFooter` |

Server component is fine (no state) — do **not** add `"use client"` unless you
need it.

> Read `app/site/AGENTS.md` first — Next 16 / Tailwind v4.
> Tailwind v4 preflight defaults `border-color` to `currentColor`. Everywhere the
> target ships a bare `border`, keep it bare **only** when a `border-*` colour
> class is also present (as it is here: `border-brand-plum`,
> `border-brand-plum/40`). Never leave `border` alone.
> The brand tokens `bg-brand-purple-light`, `text-brand-plum`, `bg-brand-plum`
> already exist in `globals.css` (`--brand-purple-light`, `--brand-plum`) —
> **do not edit `globals.css`.**

Icons: `AaLogoIcon`, `YouTubeIcon`, `RednoteIcon` already exist in
`@/components/icons` — **read that file, do not edit it.** X / LinkedIn / Discord
are not there yet; add them **inside `site-footer.tsx`** as local
`function XIcon()` etc. so `icons.tsx` stays untouched.

---

## Structure (measured verbatim)

```
footer.relative.mt-auto.bg-brand-purple-light.text-brand-plum          [1425 × 676]
└── div.container.relative.z-10
    ├── div.grid.grid-cols-1.md:grid-cols-12.gap-x-5.gap-y-12.md:gap-y-16.pt-16.md:pt-24.pb-16.md:pb-20   (h 600)
    │   ├── div.md:col-span-3.space-y-6.md:space-y-0                                    [331.3 × 176]
    │   │   ├── a[href="/"][aria-label="Artificial Analysis"].flex.items-center
    │   │   │   └── <AaGlyph className="h-28 w-28 md:h-44 md:w-44 text-brand-plum" />   (176×176 at md)
    │   │   └── p.md:hidden.font-brand-serif.text-3xl.font-medium.text-brand-plum       «Artificial Analysis»
    │   ├── div.md:col-start-5.md:col-span-5.space-y-4.md:space-y-8                     [565.4 × 176]
    │   │   ├── p.md:max-w-[17ch].text-xl.md:text-4xl.text-brand-plum                  «Get notified about new articles»
    │   │   └── div.max-w-xl > div.w-full > form.pointer-events-auto                    (h 58)
    │   ├── div.hidden.md:flex.md:col-start-12.md:col-span-1.justify-end
    │   │   └── div.w-6.h-6.bg-brand-plum                                               (24×24 swatch)
    │   ├── div.hidden.md:block.md:col-span-3.md:row-start-2
    │   │   └── p.font-brand-serif.md:text-5xl.font-medium.text-brand-plum              «Artificial Analysis»
    │   ├── div.grid.grid-cols-2.gap-x-8.md:contents
    │   │   ├── div.md:col-span-2.md:row-start-2.md:col-start-5.space-y-6               ← «Explore»
    │   │   └── div.md:col-span-2.md:row-start-2.md:col-start-8.space-y-6               ← «Company»
    │   └── div.md:col-start-11.md:col-span-2.md:row-start-2.md:self-start.flex.flex-wrap.md:justify-end.items-start.gap-6
    │       └── 5 social links
    └── div.flex.flex-wrap.items-center.gap-4.md:gap-8.py-6                             (h 76)
        ├── p.text-xs.text-brand-plum/60                                                «© 2026 Artificial Analysis»
        ├── a.text-xs.text-brand-plum/60.hover:text-brand-plum.hover:underline           «Terms of Use»
        ├── a (same className)                                                           «Privacy Policy»
        └── div.ml-auto > button[aria-label="Select language"]                            (100.3 × 28)
```

Footer computed: `background rgb(195,148,255)`, `color rgb(67,0,59)`,
`padding 0`, `font-family suisseIntl`, `font-size 16px/24px`.

### Logo glyph

The target's footer mark is a 4-square staircase. Emit it verbatim as a local
component (it is **not** the same as `AaLogoIcon` — different viewBox):

```tsx
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16"
     className="h-28 w-28 md:h-44 md:w-44 text-brand-plum">
  <path fill="currentColor" d="M13.982 16h1.996v-3.997h-3.992V16zM7.984 0 3.992 3.997H0v3.998h5.988L9.98 3.997h2.006V0zM7.984 7.995l-3.992 4.008H0V16h5.988l3.992-3.997h2.006V7.995z" />
</svg>
```
(That `d` is the full measured path — the target's `<svg>` is 353 chars total, so
this is complete.)

### Newsletter form — verbatim

```tsx
<form className="pointer-events-auto">
  <div className="flex w-full items-stretch overflow-hidden border border-brand-plum p-2 focus-within:ring-1 focus-within:ring-brand-plum focus-within:ring-offset-2 focus-within:ring-offset-brand-purple-light">
    <label htmlFor="email" className="sr-only">Email address</label>
    <input type="email" id="email" name="email" autoComplete="email" required
           placeholder="What's your email?"
           className="min-w-0 px-2 flex-1 border-none bg-transparent text-sm leading-6 text-brand-plum outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 placeholder:text-brand-plum/60" />
    <button type="submit"
            className="inline-flex h-auto items-center justify-center gap-2 whitespace-nowrap rounded-none bg-brand-plum px-4 py-2 text-sm font-semibold leading-6 text-white transition-colors hover:bg-brand-plum/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 ml-3 flex-none">
      Subscribe
    </button>
  </div>
</form>
```
Non-functional in this clone — no `onSubmit`, no state. Add `onSubmit={(e) => e.preventDefault()}`
so a stray Enter does not reload the page. Computed: input 14px/24px
`rgb(67,0,59)` `padding 8px`; button 14px/24px w600 white on `rgb(67,0,59)`,
`padding 8px 16px`, `border-radius 0`.

### Link columns

Both columns: heading `p.text-sm.md:text-base.text-brand-plum`, then
`ul.space-y-1` with bare `<li>` and
`a.text-sm.text-brand-plum.hover:underline` (14px/20px, `rgb(67,0,59)`).

| «Explore» | href | | «Company» | href |
|---|---|---|---|---|
| LLM Leaderboard | `/leaderboards/models` | | Methodology | `/methodology` |
| Image Arena | `/image/arena` | | Services | `/services` |
| Video Arena | `/video/arena` | | Contact | `/contact` |
| AI Agents | `/agents` | | Articles | `/articles` |
| Evaluations | `/evaluations` | | FAQ | `/faq` |

These are the only off-page links we keep (the user scoped the clone to this one
page). Render them as plain `<a href>` — do **not** use `next/link`, and do not
create those routes.

### Social links

Wrapper className is the long one in the tree above. Each entry, verbatim:
```tsx
<a href={href} target="_blank" className="inline-flex items-center text-brand-plum">
  <Icon className="h-6 w-6" />
  <span className="sr-only">{label}</span>
</a>
```
Order + hrefs, measured:
1. `X` — `https://x.com/ArtificialAnlys` — local `XIcon`, `viewBox="0 0 15 15"`
2. `LinkedIn` — `https://www.linkedin.com/company/artificial-analysis/` — local `LinkedInIcon`, `viewBox="0 0 15 15"`
3. `YouTube` — `https://www.youtube.com/@ArtificialAnalysisAI` — `YouTubeIcon` from `@/components/icons`
4. `Rednote` — `https://www.xiaohongshu.com/user/profile/69ea6345000000000d034c02` — `RednoteIcon` from `@/components/icons`
5. `Discord` — `https://discord.gg/Mk298GPZ7V` — local `DiscordIcon`, `viewBox="0 0 15 15"`

Every icon renders at `h-6 w-6` (24×24) and inherits `currentColor`. For the
three local icons draw a reasonable single-path glyph at the stated viewBox — the
exact path data is not recoverable from the measurement and 24×24 monochrome
marks are visually indistinguishable at this size. Note in your report that
these three paths are approximations.

### Language button

```tsx
<div className="ml-auto">
  <button type="button" aria-label="Select language"
          className="flex items-center justify-between whitespace-nowrap rounded-lg border bg-transparent ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-neutral-500 [&>span]:truncate h-7 w-auto gap-1.5 border-brand-plum/40 px-2 py-1 text-xs text-brand-plum">
    <Globe className="h-3.5 w-3.5" />
    <span>English</span>
    <ChevronDown className="h-4 w-4" />
  </button>
</div>
```
lucide `Globe` (measured 14×14) and `ChevronDown` (16×16). Computed: 12px/16px,
`padding 4px 8px`, `border 1px solid rgba(67,0,59,0.4)`, `radius 8px`,
transparent bg. Non-functional.

## Constraints

- Create only `src/components/site-footer.tsx`.
- Do not touch `globals.css`, `icons.tsx`, `page.tsx`, `layout.tsx`,
  `leaderboard.ts`, or any existing component.
- Do not create any route files.
- Run `npx tsc --noEmit` from `app/site` and report the result.

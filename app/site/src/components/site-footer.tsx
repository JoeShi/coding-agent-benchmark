"use client";

/**
 * Purple page footer — see docs/research/components/site-footer.spec.md.
 *
 * Every class string below is copied verbatim from the spec (which recorded them
 * from `getComputedStyle()` on artificialanalysis.ai). Nothing is passed through
 * `cn()` / `twMerge()` on purpose: twMerge drops classes the target actually
 * ships.
 *
 * WHY `"use client"` (the spec says a server component "is fine"):
 * the spec also mandates `onSubmit={(e) => e.preventDefault()}` on the
 * newsletter form ("Newsletter form — verbatim") so a stray Enter cannot reload
 * the page. Next 16 / React 19 RSC cannot serialise a function prop onto a host
 * element, so the module has to be a Client Component. There is still no state
 * and no hook in here — see node_modules/next/dist/docs/01-app/01-getting-started/
 * 05-server-and-client-components.md ("event handlers" ⇒ Client Component).
 *
 * Non-obvious measured values, with their spec section:
 *  - Footer computed background `rgb(195,148,255)` / colour `rgb(67,0,59)` come
 *    from the `bg-brand-purple-light` / `text-brand-plum` tokens already in
 *    globals.css — see "Structure (measured verbatim)".
 *  - The footer mark is a **4-square staircase with a different viewBox from
 *    `AaLogoIcon`** (its `d` is one square shorter); emitted verbatim below as
 *    `AaGlyph` — see "Logo glyph".
 *  - Language button: 12px/16px, `padding 4px 8px`,
 *    `border 1px solid rgba(67,0,59,0.4)`, `radius 8px`, transparent bg. The
 *    bare `border` utility is kept because `border-brand-plum/40` ships with it
 *    (Tailwind v4 preflight would otherwise paint it currentColor) — see
 *    "Language button".
 *  - `md:h-44 md:w-44` = the measured 176×176 glyph at ≥md; `md:max-w-[17ch]`
 *    is the measured wrap width of the newsletter headline.
 *
 * Mobile/responsive is out of scope: responsive class names are reproduced where
 * the spec records them, but only 1440px was QA'd.
 */

import Link from "next/link";
import { ChevronDown, Globe } from "lucide-react";
import { RednoteIcon, YouTubeIcon } from "@/components/icons";

type IconProps = React.SVGProps<SVGSVGElement>;

/**
 * Footer wordmark glyph. Verbatim from spec § "Logo glyph" — NOT `AaLogoIcon`
 * (that one carries a fourth square: `M15.978 7.995V3.997h-3.992v3.998h3.992`).
 */
function AaGlyph(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 16 16"
      {...props}
    >
      <path
        fill="currentColor"
        d="M13.982 16h1.996v-3.997h-3.992V16zM7.984 0 3.992 3.997H0v3.998h5.988L9.98 3.997h2.006V0zM7.984 7.995l-3.992 4.008H0V16h5.988l3.992-3.997h2.006V7.995z"
      />
    </svg>
  );
}

/*
 * X / LinkedIn / Discord are not in `icons.tsx` and the spec forbids editing it,
 * so they live here. The spec records only `viewBox="0 0 15 15"` for all three —
 * the target's exact path data is not recoverable from the measurement, so these
 * three glyphs are APPROXIMATIONS (official brand marks authored on a 24-unit
 * grid, uniformly scaled by 15/24 = 0.625 to land inside the measured viewBox).
 * They render monochrome at 24×24 (`h-6 w-6`) where they are visually
 * indistinguishable from the target.
 */
const BRAND_GLYPH_SCALE = "scale(0.625)";

function XIcon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 15 15"
      aria-hidden="true"
      {...props}
    >
      <g transform={BRAND_GLYPH_SCALE}>
        <path
          fill="currentColor"
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z"
        />
      </g>
    </svg>
  );
}

function LinkedInIcon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 15 15"
      aria-hidden="true"
      {...props}
    >
      <g transform={BRAND_GLYPH_SCALE}>
        <path
          fill="currentColor"
          d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
        />
      </g>
    </svg>
  );
}

function DiscordIcon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 15 15"
      aria-hidden="true"
      {...props}
    >
      <g transform={BRAND_GLYPH_SCALE}>
        <path
          fill="currentColor"
          d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c1.8483 1.3568 3.6396 2.1806 5.3973 2.7274a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.198.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 5.3992-2.7333a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"
        />
      </g>
    </svg>
  );
}

/** Spec § "Link columns". Plain `<a href>` on purpose — no `next/link`, no routes. */
const EXPLORE_LINKS: { label: string; href: string }[] = [
  { label: "LLM Leaderboard", href: "/leaderboards/models" },
  { label: "Image Arena", href: "/image/arena" },
  { label: "Video Arena", href: "/video/arena" },
  { label: "AI Agents", href: "/agents" },
  { label: "Evaluations", href: "/evaluations" },
];

const COMPANY_LINKS: { label: string; href: string }[] = [
  { label: "Methodology", href: "/methodology" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
  { label: "Articles", href: "/articles" },
  { label: "FAQ", href: "/faq" },
];

/** Spec § "Social links" — order + hrefs measured. */
const SOCIAL_LINKS: {
  label: string;
  href: string;
  Icon: (props: IconProps) => React.JSX.Element;
}[] = [
  { label: "X", href: "https://x.com/ArtificialAnlys", Icon: XIcon },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/artificial-analysis/",
    Icon: LinkedInIcon,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@ArtificialAnalysisAI",
    Icon: YouTubeIcon,
  },
  {
    label: "Rednote",
    href: "https://www.xiaohongshu.com/user/profile/69ea6345000000000d034c02",
    Icon: RednoteIcon,
  },
  { label: "Discord", href: "https://discord.gg/Mk298GPZ7V", Icon: DiscordIcon },
];

/** Both columns share this markup — spec § "Link columns". */
function LinkColumn({
  className,
  heading,
  links,
}: {
  className: string;
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className={className}>
      <p className="text-sm md:text-base text-brand-plum">{heading}</p>
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-brand-plum hover:underline"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-auto bg-brand-purple-light text-brand-plum">
      <div className="container relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-5 gap-y-12 md:gap-y-16 pt-16 md:pt-24 pb-16 md:pb-20">
          <div className="md:col-span-3 space-y-6 md:space-y-0">
            {/* `next/link` rather than a bare `<a>`: it renders the identical
                `<a href="/" aria-label class>` in the App Router, so the DOM still
                matches the target, and it satisfies
                `@next/next/no-html-link-for-pages` (an eslint ERROR, since `/` is a
                real route here). */}
            <Link
              href="/"
              aria-label="Artificial Analysis"
              className="flex items-center"
            >
              <AaGlyph className="h-28 w-28 md:h-44 md:w-44 text-brand-plum" />
            </Link>
            <p className="md:hidden font-brand-serif text-3xl font-medium text-brand-plum">
              Artificial Analysis
            </p>
          </div>

          <div className="md:col-start-5 md:col-span-5 space-y-4 md:space-y-8">
            <p className="md:max-w-[17ch] text-xl md:text-4xl text-brand-plum">
              Get notified about new articles
            </p>
            <div className="max-w-xl">
              <div className="w-full">
                {/* Non-functional in this clone: no state, no submit target. */}
                <form
                  className="pointer-events-auto"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div className="flex w-full items-stretch overflow-hidden border border-brand-plum p-2 focus-within:ring-1 focus-within:ring-brand-plum focus-within:ring-offset-2 focus-within:ring-offset-brand-purple-light">
                    <label htmlFor="email" className="sr-only">
                      Email address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      required
                      placeholder="What's your email?"
                      className="min-w-0 px-2 flex-1 border-none bg-transparent text-sm leading-6 text-brand-plum outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 placeholder:text-brand-plum/60"
                    />
                    <button
                      type="submit"
                      className="inline-flex h-auto items-center justify-center gap-2 whitespace-nowrap rounded-none bg-brand-plum px-4 py-2 text-sm font-semibold leading-6 text-white transition-colors hover:bg-brand-plum/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 ml-3 flex-none"
                    >
                      Subscribe
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* 24×24 plum swatch in the top-right grid cell. */}
          <div className="hidden md:flex md:col-start-12 md:col-span-1 justify-end">
            <div className="w-6 h-6 bg-brand-plum" />
          </div>

          <div className="hidden md:block md:col-span-3 md:row-start-2">
            <p className="font-brand-serif md:text-5xl font-medium text-brand-plum">
              Artificial Analysis
            </p>
          </div>

          {/* `md:contents` dissolves this wrapper at ≥md so both columns become
              direct grid items of the 12-col grid. */}
          <div className="grid grid-cols-2 gap-x-8 md:contents">
            <LinkColumn
              className="md:col-span-2 md:row-start-2 md:col-start-5 space-y-6"
              heading="Explore"
              links={EXPLORE_LINKS}
            />
            <LinkColumn
              className="md:col-span-2 md:row-start-2 md:col-start-8 space-y-6"
              heading="Company"
              links={COMPANY_LINKS}
            />
          </div>

          <div className="md:col-start-11 md:col-span-2 md:row-start-2 md:self-start flex flex-wrap md:justify-end items-start gap-6">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                className="inline-flex items-center text-brand-plum"
              >
                <Icon className="h-6 w-6" />
                <span className="sr-only">{label}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 md:gap-8 py-6">
          <p className="text-xs text-brand-plum/60">
            © 2026 Artificial Analysis
          </p>
          <a
            href="/terms-of-use"
            className="text-xs text-brand-plum/60 hover:text-brand-plum hover:underline"
          >
            Terms of Use
          </a>
          <a
            href="/privacy-policy"
            className="text-xs text-brand-plum/60 hover:text-brand-plum hover:underline"
          >
            Privacy Policy
          </a>
          <div className="ml-auto">
            {/* Non-functional (no locale switching in this clone). */}
            <button
              type="button"
              aria-label="Select language"
              className="flex items-center justify-between whitespace-nowrap rounded-lg border bg-transparent ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-neutral-500 [&>span]:truncate h-7 w-auto gap-1.5 border-brand-plum/40 px-2 py-1 text-xs text-brand-plum"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>English</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// suisseIntl / victorSerifBasic are commercial licensed typefaces, mirrored from
// the target for local fidelity work only. See docs/research/FOUNDATION.md.
// `adjustFontFallback: "Arial"` (the default) regenerates the same
// "* Fallback" faces with metric overrides that the target ships.
const suisseIntl = localFont({
  src: [
    { path: "../fonts/suisse-intl-300.woff2", weight: "300", style: "normal" },
    { path: "../fonts/suisse-intl-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/suisse-intl-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-suisse-intl",
  display: "swap",
  adjustFontFallback: "Arial",
});

const victorSerifBasic = localFont({
  src: [
    { path: "../fonts/victor-serif-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/victor-serif-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-victor-serif",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "Coding Agents Index",
  description:
    "Kiro CLI benchmark results across DeepSWE, Terminal-Bench v2 and SWE-Atlas-QnA, presented in the Artificial Analysis Coding Agent Index format.",
  icons: { icon: [{ url: "/seo/favicon.ico", sizes: "16x16", type: "image/x-icon" }] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${suisseIntl.variable} ${victorSerifBasic.variable} h-full antialiased`}
    >
      {/* Measured verbatim from the target. `mt-auto` on the footer resolves
          against `main.min-h-screen` (page.tsx), not against the body, so the
          body carries no flex column here. */}
      <body className="h-full overscroll-y-none relative font-brand-sans text-foreground bg-background">
        {children}
      </body>
    </html>
  );
}

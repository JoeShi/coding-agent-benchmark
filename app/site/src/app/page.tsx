/**
 * `/agents/coding-agents` — the whole page.
 *
 * The tree below is the measured one: `main.min-h-screen` has FIVE children (the
 * nav wrapper, `div.pb-40`, the back-to-top button, an empty `<section>`, and the
 * footer). The footer sitting INSIDE `main` is what makes its `mt-auto` resolve.
 */

import { BackToTop } from "@/components/back-to-top";
import { BenchmarkSections } from "@/components/benchmark-sections";
import { FaqSection } from "@/components/faq-section";
import { HeroSection } from "@/components/hero-section";
import { HighlightsSection } from "@/components/highlights-section";
import { RunSpecsSection } from "@/components/run-specs-section";
import { ScrollSpySidebar } from "@/components/scroll-spy-sidebar";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { getRows } from "@/lib/leaderboard";

export default function Home() {
  const rows = getRows("official");

  return (
    <main className="min-h-screen">
      <SiteNav />

      <div className="pb-40">
        <HeroSection />
        <HighlightsSection />

        <div className="container mb-24">
          <div className="grid grid-cols-12 gap-7">
            <aside className="hidden lg:block col-span-2">
              <ScrollSpySidebar />
            </aside>
            <div className="col-span-full lg:col-span-10 flex flex-col gap-16">
              <BenchmarkSections rows={rows} />
            </div>
          </div>
        </div>

        <div className="container">
          <div className="mt-6">
            <RunSpecsSection />
          </div>
          {/* The FAQPage JSON-LD lives INSIDE `section.mt-16` on the target, so
              `FaqSection` emits it itself. */}
          <FaqSection />
        </div>
      </div>

      <BackToTop />
      {/* Present but empty on the target. */}
      <section />
      <SiteFooter />
    </main>
  );
}

import type { ReactNode } from "react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Container } from "@/components/ui/Section";
import { Leaf, Sprig } from "@/components/ui/Botanical";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Shared structure for Privacy / Terms / Disclosures pages.
 * These pages are the current MVP legal baseline, subject to future revision.
 */
export function InfoPageLayout({
  title,
  updatedLabel = "MVP legal baseline — subject to future revision",
  children,
}: {
  title: string;
  updatedLabel?: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden bg-cream-50 py-16 sm:py-20">
          <Leaf className="pointer-events-none absolute -left-16 top-8 h-56 w-56 text-brand-600/8" />
          <Sprig className="pointer-events-none absolute -bottom-8 right-0 h-44 w-44 text-forest-700/8" />
          <Container className="py-0">
            <div className="mx-auto max-w-2xl">
              <Reveal>
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  {updatedLabel}
                </p>
              </Reveal>
              <Reveal delay={100}>
                <div className="mt-8 space-y-6 leading-relaxed text-neutral-700">
                  {children}
                </div>
              </Reveal>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export function InfoSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-neutral-900">{heading}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

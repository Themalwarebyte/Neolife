import type { ReactNode } from "react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Container } from "@/components/ui/Section";

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
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {updatedLabel}
            </p>
            <div className="mt-8 space-y-6 leading-relaxed text-neutral-700">
              {children}
            </div>
          </div>
        </Container>
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

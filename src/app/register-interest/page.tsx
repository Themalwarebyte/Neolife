import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Register Interest — NEOLIFE" };

/**
 * Placeholder destination for the primary CTA.
 * Task 1.5 (lead capture) will replace this page with the real
 * interest-registration form. Do not treat as final.
 */
export default function RegisterInterestPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Container className="py-20 sm:py-28">
          <div className="mx-auto max-w-xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Register your interest
            </h1>
            <p className="mt-4 text-lg text-neutral-600">
              Our online interest form is being finalised. In the meantime, the
              office team will be glad to hear from you and answer your
              questions.
            </p>
            <div className="mt-8">
              <CtaLink href="/#faq" variant="secondary" size="lg">
                Read the FAQ
              </CtaLink>
            </div>
            <p className="mt-6 text-sm text-neutral-500">
              No cost, no obligation. Results vary; nothing is guaranteed.
            </p>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}

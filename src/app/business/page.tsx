import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LeadForm } from "@/components/leads/LeadForm";
import { Container } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Leaf, Sprig } from "@/components/ui/Botanical";

export const metadata: Metadata = { title: "Business Opportunity — NEOLIFE" };

/**
 * Referral entry point (D-034): https://neolife.ooflowdesk.com/business?ref=<code>
 *
 * The `ref` query parameter is OPAQUE — it is forwarded to the lead-capture
 * Server Action untouched (after a structural client-side echo so a shared
 * link keeps its code across the form) and resolved server-side only.
 * No user ID, staff name or account state is exposed in this page's HTML:
 * an unknown/revoked code is silently treated as no referral.
 */
export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  // Structural echo only: bounded, URL-safe charset — never an ID or name.
  const refCode =
    typeof params.ref === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(params.ref)
      ? params.ref
      : undefined;

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
                <div className="text-center">
                  <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                    The NEOLIFE opportunity
                  </p>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                    Build a business on real wellness
                  </h1>
                  <p className="mt-4 text-lg text-neutral-600">
                    Register your interest and the NEOLIFE office team will
                    contact you to answer your questions and, if you would
                    like, arrange a meeting. No cost, no obligation.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={100}>
                <div className="mt-10 rounded-3xl border border-neutral-100 bg-white p-6 shadow-xl shadow-neutral-900/5 sm:p-10">
                  <LeadForm referralCode={refCode} />
                </div>
              </Reveal>

              <Reveal delay={200}>
                <p className="mt-6 text-center text-sm text-neutral-500">
                  Fields marked * are required. Results vary; no income or
                  business results are guaranteed.
                </p>
              </Reveal>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

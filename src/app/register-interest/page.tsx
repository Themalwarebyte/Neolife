import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LeadForm } from "@/components/leads/LeadForm";
import { Container } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Register Interest — NEOLIFE" };

/**
 * Task 1.5 — real lead capture (replaces the Task 1.3 placeholder).
 * Attribution (UTM etc.) is intentionally not captured here — Task 1.4.
 */
export default function RegisterInterestPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                Register interest
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                Tell us a little about yourself
              </h1>
              <p className="mt-4 text-lg text-neutral-600">
                After you submit, the office team will contact you to answer
                your questions and, if you would like, arrange a meeting at our
                office. No cost, no obligation.
              </p>
            </div>

            <div className="mt-10 rounded-3xl border border-neutral-100 bg-white p-6 shadow-xl shadow-neutral-900/5 sm:p-10">
              <LeadForm />
            </div>

            <p className="mt-6 text-center text-sm text-neutral-500">
              Fields marked * are required. Results vary; no income or business
              results are guaranteed.
            </p>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}

import { CtaLink } from "@/components/ui/CtaLink";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";

/**
 * Final CTA section. In the MVP funnel this is where lead capture
 * (Task 1.5) will be embedded once implemented.
 */
export function CtaSection() {
  return (
    <Section id="register-interest-cta" ariaLabel="Register your interest">
      <Reveal>
        <div className="rounded-3xl bg-brand-600 px-8 py-14 text-center shadow-lg shadow-brand-600/20 sm:px-14">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Want to learn more in person?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50">
            Register your interest and the office team will contact you to
            answer questions and arrange a conversation. No cost, no
            obligation.
          </p>
          <div className="mt-8">
            <CtaLink
              href="/register-interest"
              variant="secondary"
              size="lg"
              className="bg-white text-brand-700 ring-0 hover:text-brand-800"
            >
              Register Your Interest
            </CtaLink>
          </div>
          <p className="mt-6 text-xs text-brand-100">
            Results vary. No income or business results are guaranteed.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

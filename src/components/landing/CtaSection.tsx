import { CtaLink } from "@/components/ui/CtaLink";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { Leaf } from "@/components/ui/Botanical";

export function CtaSection() {
  return (
    <Section
      id="register-interest-cta"
      ariaLabel="Register your interest"
      className="relative overflow-hidden bg-forest-900"
    >
      <Leaf className="pointer-events-none absolute -left-10 -top-8 h-40 w-40 rotate-90 text-brand-500/15" />
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Want to learn more in person?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50/90">
            Register your interest and the office team will contact you to
            answer questions and arrange a conversation. No cost, no
            obligation.
          </p>
          <div className="mt-8">
            <CtaLink href="/register-interest" size="lg" className="bg-white text-forest-800 hover:text-forest-900">
              Register Your Interest
            </CtaLink>
          </div>
          <p className="mt-6 text-xs text-brand-100/80">
            Results vary. No income or business results are guaranteed.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}


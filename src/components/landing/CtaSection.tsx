import { CtaLink } from "@/components/ui/CtaLink";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Section";
import { Photo } from "@/components/ui/Photo";

export function CtaSection() {
  return (
    <section
      id="register-interest-cta"
      aria-label="Register your interest"
      className="relative isolate overflow-hidden"
    >
      <Photo
        tone="forest"
        overlay
        alt=""
        className="absolute inset-0 -z-10 h-full w-full"
        sizes="100vw"
      />

      <Container className="py-20 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Want to learn more in person?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">
              Register your interest and the office team will contact you to
              answer questions and arrange a conversation. No cost, no
              obligation.
            </p>
            <div className="mt-8">
              <CtaLink
                href="/register-interest"
                size="lg"
                className="bg-white text-forest-900 shadow-lg hover:text-forest-800"
              >
                Register Your Interest
              </CtaLink>
            </div>
            <p className="mt-6 text-xs text-white/80">
              Results vary. No income or business results are guaranteed.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}


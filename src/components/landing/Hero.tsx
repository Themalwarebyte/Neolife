import { CtaLink } from "@/components/ui/CtaLink";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Section";
import { BotanicalImage, Leaf, Sprig } from "@/components/ui/Botanical";

export function Hero() {
  return (
    <section
      aria-label="Introduction"
      className="botanical-grid relative overflow-hidden bg-cream-50"
    >
      <Leaf className="pointer-events-none absolute -left-16 top-10 h-48 w-48 text-brand-600/20" />
      <Leaf className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 rotate-180 text-forest-700/10" />

      <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2">
        <Reveal>
          <p className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-700">
            Health &amp; wellness business opportunity
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-5xl">
            Build a health and wellness business,{" "}
            <span className="text-forest-700">rooted in nature</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
            NEOLIFE products have supported families for generations. We help
            motivated people learn about, share, and grow a business around
            quality nutrition products — with real products, real training and a
            real team behind you.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaLink href="/register-interest" size="lg">
              Register Your Interest
            </CtaLink>
            <CtaLink href="/#how-it-works" variant="secondary" size="lg">
              See How It Works
            </CtaLink>
          </div>
          <p className="mt-5 text-sm text-neutral-500">
            No purchase required to learn more. We will contact you to answer
            questions and arrange an office conversation.
          </p>
        </Reveal>

        <Reveal delay={150} className="relative hidden lg:block">
          <div className="relative h-[420px]">
            <BotanicalImage tone="pale" className="absolute inset-0" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sprig className="h-44 w-44 text-forest-700/30" />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}


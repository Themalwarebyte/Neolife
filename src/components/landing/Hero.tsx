import { CtaLink } from "@/components/ui/CtaLink";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Section";
import { Leaf } from "@/components/ui/Botanical";
import { Photo } from "@/components/ui/Photo";

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
          <Photo
            tone="botanical"
            alt="Wellness and botanical lifestyle"
            className="h-[460px] rounded-[2rem] shadow-xl shadow-forest-900/10"
          />
          <div className="absolute -bottom-6 -left-6 w-64 rounded-2xl bg-white p-5 shadow-xl">
            <p className="font-bold text-neutral-900">People first</p>
            <p className="mt-1 text-sm text-neutral-600">
              Training, mentoring and a local team behind you.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}


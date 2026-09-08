import { CtaLink } from "@/components/ui/CtaLink";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Section";

export function Hero() {
  return (
    <section
      aria-label="Introduction"
      className="relative overflow-hidden bg-linear-to-b from-brand-50 to-white"
    >
      <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2">
        <Reveal>
          <p className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-700">
            Health &amp; wellness business opportunity
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-5xl">
            Build a health and wellness business,{" "}
            <span className="text-brand-600">on your own terms</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
            NEOLIFE products have supported families for generations. We help
            motivated people learn about, share, and grow a business around
            quality nutrition products — with real products, real training and
            a real team behind you.
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

        <Reveal delay={150} className="hidden lg:block">
          <div
            className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-xl shadow-neutral-900/5"
            aria-hidden="true"
          >
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-full bg-brand-100" />
              <div>
                <div className="h-2.5 w-28 rounded-full bg-neutral-200" />
                <div className="mt-2 h-2.5 w-20 rounded-full bg-neutral-100" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-3 w-full rounded-full bg-neutral-100" />
              <div className="h-3 w-5/6 rounded-full bg-neutral-100" />
              <div className="h-3 w-4/6 rounded-full bg-neutral-100" />
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-brand-50 p-4">
                <div className="h-2 w-10 rounded-full bg-brand-500/60" />
                <div className="mt-2 h-6 w-14 rounded bg-white" />
              </div>
              <div className="rounded-2xl bg-neutral-50 p-4">
                <div className="h-2 w-10 rounded-full bg-neutral-300" />
                <div className="mt-2 h-6 w-14 rounded bg-white" />
              </div>
              <div className="rounded-2xl bg-neutral-50 p-4">
                <div className="h-2 w-10 rounded-full bg-neutral-300" />
                <div className="mt-2 h-6 w-14 rounded bg-white" />
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

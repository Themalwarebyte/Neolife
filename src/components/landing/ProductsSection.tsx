import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Section";
import { CtaLink } from "@/components/ui/CtaLink";
import { Leaf } from "@/components/ui/Botanical";
import { Photo } from "@/components/ui/Photo";

const pillars = [
  {
    title: "Whole-food nutrition",
    body: "A range focused on natural, whole-food-based nutrition for everyday wellness.",
  },
  {
    title: "Wellness lifestyle",
    body: "A brand built around simple, everyday nutrition and wellbeing support.",
  },
  {
    title: "Quality you can share",
    body: "Products you can learn about and confidently share with others.",
  },
];

export function ProductsSection() {
  return (
    <section id="products" aria-label="Products and wellness" className="relative overflow-hidden bg-forest-800">
      <Leaf className="pointer-events-none absolute -right-16 -top-10 h-52 w-52 text-brand-500/15" />

      <Container className="py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Photo
              tone="forest"
              alt="Botanical and natural nutrition"
              className="h-[420px] rounded-[2rem] shadow-2xl shadow-black/30 ring-1 ring-brand-400/20"
            />
          </Reveal>

          <div>
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
                Products &amp; wellness
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Rooted in whole-food nutrition
              </h2>
              <p className="mt-4 text-lg text-brand-50/90">
                The NEOLIFE range brings together nutrition, wellness and a
                science-informed approach to everyday wellbeing.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {pillars.map((pillar, index) => (
                <Reveal key={pillar.title} delay={index * 100}>
                  <div className="h-full rounded-3xl border border-forest-600/40 bg-forest-900/40 p-6">
                    <h3 className="font-bold text-white">{pillar.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-brand-50/80">{pillar.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={200}>
              <div className="mt-8">
                <CtaLink href="#register-interest-cta" variant="secondary" size="md" className="bg-white text-forest-800 hover:text-forest-900">
                  Learn about our products
                </CtaLink>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}


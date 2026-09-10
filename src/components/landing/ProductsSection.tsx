import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Section";
import { Leaf, Sprig } from "@/components/ui/Botanical";

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
      <Sprig className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 text-brand-500/10" />

      <Container className="py-16 sm:py-24">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
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
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar, index) => (
            <Reveal key={pillar.title} delay={index * 120}>
              <div className="h-full rounded-3xl border border-forest-600/40 bg-forest-900/40 p-7">
                <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-100">
                  <Leaf className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-white">{pillar.title}</h3>
                <p className="mt-3 leading-relaxed text-brand-50/80">{pillar.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";

const pillars = [
  {
    title: "Quality products",
    body: "Represent the NEOLIFE nutrition and wellness range — products with decades of history and a focus on whole-food nutrition.",
  },
  {
    title: "A proven path",
    body: "Follow a structured path: learn the products, share with customers, and build a team at a pace that fits your life.",
  },
  {
    title: "People first",
    body: "You are supported by a local team and an office that trains, mentors and works with you face to face.",
  },
];

export function OpportunitySection() {
  return (
    <Section id="opportunity" ariaLabel="The opportunity">
      <SectionHeading
        eyebrow="The opportunity"
        title="What the NEOLIFE business is really about"
        description="A straightforward, people-driven business built around quality nutrition products and personal development."
      />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {pillars.map((pillar, index) => (
          <Reveal key={pillar.title} delay={index * 120}>
            <article className="h-full rounded-3xl border border-neutral-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-lg hover:shadow-neutral-900/5">
              <span
                aria-hidden="true"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"
              >
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold text-neutral-900">
                {pillar.title}
              </h3>
              <p className="mt-3 leading-relaxed text-neutral-600">
                {pillar.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

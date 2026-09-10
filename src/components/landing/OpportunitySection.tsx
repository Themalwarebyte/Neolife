import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";
import { BotanicalImage } from "@/components/ui/Botanical";

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
    <Section id="opportunity" ariaLabel="The opportunity" className="bg-brand-50">
      <SectionHeading
        eyebrow="The opportunity"
        title="What the NEOLIFE business is really about"
        description="A straightforward, people-driven business built around quality nutrition products and personal development."
      />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {pillars.map((pillar, index) => (
          <Reveal key={pillar.title} delay={index * 120}>
            <article className="h-full overflow-hidden rounded-3xl bg-white shadow-sm transition-shadow hover:shadow-lg">
              <BotanicalImage tone={index === 1 ? "forest" : "pale"} className="h-36 rounded-none" />
              <div className="p-7">
                <h3 className="text-lg font-bold text-neutral-900">{pillar.title}</h3>
                <p className="mt-3 leading-relaxed text-neutral-600">{pillar.body}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}


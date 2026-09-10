import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Photo } from "@/components/ui/Photo";

const supports = [
  {
    title: "Local office & team",
    body: "A physical office where you can ask questions, attend sessions and get face-to-face support.",
  },
  {
    title: "Product training",
    body: "Learn about the NEOLIFE range so you can share it accurately and confidently.",
  },
  {
    title: "Business mentoring",
    body: "Work alongside experienced distributors who help you plan and grow step by step.",
  },
  {
    title: "Community",
    body: "Join a team of people building their businesses and learning together.",
  },
];

export function SupportSection() {
  return (
    <Section id="support" ariaLabel="Support and training" className="bg-cream-50">
      <SectionHeading
        eyebrow="Support"
        title="You are not doing this alone"
        description="Training, mentoring and a local team come with the journey."
      />
      <div className="mt-14 grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <Photo
            tone="warm"
            alt="Supportive community and mentoring"
            priority={false}
            className="h-[360px] rounded-[2rem] shadow-xl shadow-forest-900/10 lg:h-[460px]"
          />
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2">
          {supports.map((item, index) => (
            <Reveal key={item.title} delay={index * 100}>
              <article className="h-full rounded-3xl border border-cream-100 bg-white p-7">
                <span aria-hidden="true" className="mt-1 h-10 w-1.5 rounded-full bg-brand-500" />
                <h3 className="mt-3 font-bold text-neutral-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}


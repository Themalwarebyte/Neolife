import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Leaf } from "@/components/ui/Botanical";

const steps = [
  {
    title: "Learn",
    body: "Meet the team, understand the products and how the business works — with honest answers to your questions.",
  },
  {
    title: "Register your interest",
    body: "Tell us a little about yourself so we can prepare for a proper conversation in the office.",
  },
  {
    title: "Office meeting",
    body: "Sit down with us to map out your goals and how the business could work for you.",
  },
  {
    title: "Start, with support",
    body: "Begin at your own pace with training, mentoring and a team behind you.",
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works" ariaLabel="How it works" className="botanical-grid bg-cream-50">
      <SectionHeading
        eyebrow="How it works"
        title="From first question to first step"
        description="We keep the process simple and personal — no pressure, and no obligations before you are ready."
      />
      <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <Reveal key={step.title} delay={index * 100}>
            <li className="relative h-full rounded-3xl border border-cream-100 bg-white p-7">
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-forest-700 text-sm font-bold text-white"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 font-bold text-neutral-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.body}</p>
              <Leaf className="absolute bottom-3 right-3 h-8 w-8 text-brand-600/20" />
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}


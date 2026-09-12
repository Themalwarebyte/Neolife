import Image from "next/image";
import { Container, SectionHeading } from "@/components/ui/Section";

const faqs = [
  {
    question: "Do I need money to start?",
    answer:
      "No. There is no fee to learn about the business. If and when you decide to start, we will walk you through the options in person so you can decide what suits you.",
  },
  {
    question: "Is this a real job with a salary?",
    answer:
      "No. This is a business opportunity, not employment. Your results depend on your own effort, experience and skill — nothing is guaranteed.",
  },
  {
    question: "What will I actually be doing?",
    answer:
      "Learning about the NEOLIFE product range, sharing it with customers, and — if you choose — building a team, with training and mentoring along the way.",
  },
  {
    question: "Do I need experience in sales or nutrition?",
    answer:
      "No. We provide product and business training, and you start at your own pace with support from the local office and team.",
  },
  {
    question: "What happens after I register interest?",
    answer:
      "Someone from the office contacts you to answer your questions and, if you would like, arranges a meeting at our office.",
  },
];

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-label="Frequently asked questions"
      className="relative isolate overflow-hidden"
    >
      <Image
        src="/images/landing/faq.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-cream-50/85" aria-hidden="true" />

      <Container className="relative py-16 sm:py-24">
        <SectionHeading
          eyebrow="FAQ"
          title="Honest answers first"
          description="Straightforward questions, straightforward answers."
        />
        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-neutral-200 bg-white open:border-brand-500/40 open:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold text-neutral-900">
                {faq.question}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-brand-600 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-6 pb-6 leading-relaxed text-neutral-600">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

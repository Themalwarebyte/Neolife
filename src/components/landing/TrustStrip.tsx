import { Container } from "@/components/ui/Section";

const points = [
  { title: "Whole-food nutrition", body: "A focus on quality, naturally sourced nutrition." },
  { title: "Generations of trust", body: "Products with a long history of family use." },
  { title: "People first", body: "Training, mentoring and a local team behind you." },
];

export function TrustStrip() {
  return (
    <section aria-label="Why NEOLIFE" className="border-y border-brand-100 bg-white">
      <Container className="grid gap-8 py-8 sm:grid-cols-3">
        {points.map((point) => (
          <div key={point.title} className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
            <div>
              <p className="font-semibold text-neutral-900">{point.title}</p>
              <p className="text-sm text-neutral-500">{point.body}</p>
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}

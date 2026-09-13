import { CtaLink } from "@/components/ui/CtaLink";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Section";
import { Leaf, Sprig } from "@/components/ui/Botanical";
import { Photo } from "@/components/ui/Photo";
import { CATALOGUE_CATEGORIES } from "@/lib/catalogue-meta";

export function CatalogueHero() {
  return (
    <section
      aria-label="Product catalogue"
      className="relative overflow-hidden bg-forest-800"
    >
      <Leaf className="pointer-events-none absolute -left-24 -top-16 h-72 w-72 text-brand-500/15" />
      <Sprig className="pointer-events-none absolute -bottom-12 -right-10 h-56 w-56 text-brand-500/10" />

      <Container className="grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
              Product catalogue
            </p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              Browse the NEOLIFE range
            </h1>
            <p className="mt-5 max-w-xl text-lg text-brand-50/90">
              From whole-food nutrition and wellness support to organic skincare
              and home care, the NEOLIFE range covers everyday needs. Browse by
              category, find a product that interests you, and tell us about it.
            </p>
          </Reveal>

          <Reveal delay={100} className="mt-8 flex flex-wrap items-center gap-4">
            <CtaLink href="#categories" size="lg">
              Browse categories
            </CtaLink>
            <a
              href="#catalogue-search"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Search products
            </a>
          </Reveal>

          <Reveal delay={200} className="mt-6 flex flex-wrap gap-6 text-sm text-brand-50/80">
            <span className="inline-flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {CATALOGUE_CATEGORIES.length} product categories
            </span>
            <span className="inline-flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Search across the full range
            </span>
          </Reveal>
        </div>

        <Reveal delay={150} className="relative hidden lg:block">
          <Photo
            src="/images/landing/wellness.webp"
            alt="Fresh healthy salad bowl"
            className="h-[460px] rounded-[2rem] shadow-2xl shadow-black/40 ring-1 ring-brand-400/20"
          />
          <div className="absolute -bottom-6 -left-6 w-64 rounded-2xl bg-white p-5 shadow-xl">
            <p className="font-bold text-neutral-900">Whole-food nutrition</p>
            <p className="mt-1 text-sm text-neutral-600">
              A range built on natural, whole-food-based nutrition for everyday wellness.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
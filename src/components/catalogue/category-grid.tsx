import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Section";
import { Leaf, Sprig } from "@/components/ui/Botanical";
import { Photo } from "@/components/ui/Photo";
import Link from "next/link";
import { CATALOGUE_CATEGORIES, PRODUCTS_PATH, CATEGORY_IMAGES, productsForCategory } from "@/lib/catalogue-meta";

export function CategoryGrid() {
  return (
    <section
      id="categories"
      aria-label="Product categories"
      className="relative overflow-hidden bg-cream-50 py-16 sm:py-20"
    >
      <Leaf className="pointer-events-none absolute -left-16 top-0 h-64 w-64 text-brand-600/10" />
      <Sprig className="pointer-events-none absolute -bottom-10 right-0 h-48 w-48 text-forest-700/10" />

      <Container>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Browse by category
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Four categories, one range
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              From whole-food nutrition to organic skincare and home care, the
              NEOLIFE range covers everyday needs.
            </p>
          </Reveal>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CATALOGUE_CATEGORIES.map((category, index) => {
            const products = productsForCategory(category.slug);
            return (
              <Reveal key={category.slug} delay={index * 80}>
                <LinkCard
                  category={category}
                  productCount={products.length}
                />
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function LinkCard({
  category,
  productCount,
}: {
  category: (typeof CATALOGUE_CATEGORIES)[number];
  productCount: number;
}) {
  return (
    <Link
      href={`${PRODUCTS_PATH}/${category.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-forest-900/10"
    >
      <div className="relative aspect-[3/2] overflow-hidden">
         <Photo
           src={CATEGORY_IMAGES[category.slug]}
           alt={category.name}
           tone="botanical"
           className="h-full w-full"
         />
        <div className="absolute inset-0 bg-linear-to-t from-forest-900/70 via-forest-900/20 to-transparent" />
        <div className="absolute left-4 right-4 bottom-4">
          <h3 className="text-xl font-bold text-white transition-colors group-hover:text-brand-50">
            {category.name}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600">
          {category.description}
        </p>
        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {productCount} product{productCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors group-hover:text-forest-700">
            Browse
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
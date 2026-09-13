import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Container } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Leaf, Sprig } from "@/components/ui/Botanical";
import {
  categoryBySlug,
  subcategoryBySlug,
  productsForSubcategory,
  subcategoryBreadcrumb,
  buildTitle,
} from "@/lib/catalogue-meta";
import { BreadcrumbNav } from "@/components/catalogue/Breadcrumb";
import { ProductCard, EmptyState } from "@/components/catalogue/ProductCard";

interface Props {
  params: Promise<{ category: string; subcategory: string }>;
}

export function generateMetadata({ params }: Props) {
  return params.then(({ category, subcategory }) => {
    const cat = categoryBySlug(category);
    const sub = subcategoryBySlug(subcategory);
    if (!cat || !sub) return { title: buildTitle(["Not found"]) };
    return {
      title: buildTitle([cat.name, sub.name]),
      description: sub.description,
      alternates: { canonical: `/products/${cat.slug}/${sub.slug}` },
      openGraph: {
        title: `${cat.name} — ${sub.name}`,
        description: sub.description,
        url: `/products/${cat.slug}/${sub.slug}`,
        type: "website",
      },
    };
  });
}

export default async function SubcategoryPage({ params }: Props) {
  const { category: categorySlug, subcategory: subSlug } = await params;
  const category = categoryBySlug(categorySlug);
  const subcategory = subcategoryBySlug(subSlug);

  if (!category || !subcategory || subcategory.categorySlug !== categorySlug) {
    notFound();
  }

  const products = productsForSubcategory(subSlug);
  const breadcrumbs = subcategoryBreadcrumb(categorySlug, subSlug);

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section
          aria-label={subcategory.name}
          className="relative overflow-hidden bg-forest-800"
        >
          <Leaf className="pointer-events-none absolute -left-20 -top-12 h-64 w-64 text-brand-500/15" />
          <Sprig className="pointer-events-none absolute -bottom-10 -right-8 h-48 w-48 text-brand-500/10" />

          <Container className="py-16 sm:py-20">
            <BreadcrumbNav items={breadcrumbs} />

            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
                {category.name}
              </p>
              <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
                {subcategory.name}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-brand-50/90">
                {subcategory.description}
              </p>
            </Reveal>
          </Container>
        </section>

        <section className="bg-cream-50 py-12 sm:py-16">
          <Container>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900">{products.length}</span>{" "}
                product{products.length === 1 ? "" : "s"} in this subcategory
              </p>
            </div>

            {products.length === 0 ? (
              <EmptyState message="No products in this subcategory yet." />
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.slug}
                    product={product}
                    categorySlug={categorySlug}
                    subcategorySlug={subSlug}
                    index={index}
                  />
                ))}
              </div>
            )}
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
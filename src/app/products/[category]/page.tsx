import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Container } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Leaf, Sprig } from "@/components/ui/Botanical";
import {
  categoryBySlug,
  subcategoriesForCategory,
  productsForCategory,
  categoryBreadcrumb,
} from "@/lib/catalogue-meta";
import { BreadcrumbNav } from "@/components/catalogue/Breadcrumb";
import { SubcategoryFilter } from "@/components/catalogue/SubcategoryFilter";
import { ProductCard, EmptyState } from "@/components/catalogue/ProductCard";

interface Props {
  params: Promise<{ category: string }>;
}

export function generateMetadata({ params }: Props) {
  return params.then(({ category }) => {
    const cat = categoryBySlug(category);
    if (!cat) return { title: "Category not found" };
    return {
      title: cat.name,
      description: cat.description,
      alternates: { canonical: `/products/${cat.slug}` },
      openGraph: {
        title: cat.name,
        description: cat.description,
        url: `/products/${cat.slug}`,
        type: "website",
      },
    };
  });
}

export default async function CategoryPage({ params }: Props) {
  const { category: categorySlug } = await params;
  const category = categoryBySlug(categorySlug);
  if (!category) notFound();

  const subcategories = subcategoriesForCategory(categorySlug);
  const products = productsForCategory(categorySlug);
  const breadcrumbs = categoryBreadcrumb(categorySlug);

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section
          aria-label={category.name}
          className="relative overflow-hidden bg-forest-800"
        >
          <Leaf className="pointer-events-none absolute -left-20 -top-12 h-64 w-64 text-brand-500/15" />
          <Sprig className="pointer-events-none absolute -bottom-10 -right-8 h-48 w-48 text-brand-500/10" />

          <Container className="py-16 sm:py-20">
            <BreadcrumbNav items={breadcrumbs} />

            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
                Product category
              </p>
              <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
                {category.name}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-brand-50/90">
                {category.description}
              </p>
            </Reveal>
          </Container>
        </section>

        <section className="bg-cream-50 py-12 sm:py-16">
          <Container>
            <SubcategoryFilter
              subcategories={subcategories}
              activeSlug={null}
              categorySlug={categorySlug}
            />

            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900">{products.length}</span>{" "}
                product{products.length === 1 ? "" : "s"} in this category
              </p>
            </div>

            {products.length === 0 ? (
              <EmptyState message="No products in this category yet." />
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.slug}
                    product={product}
                    categorySlug={categorySlug}
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

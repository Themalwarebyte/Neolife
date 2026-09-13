import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Container } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Leaf, Sprig } from "@/components/ui/Botanical";
import { Photo } from "@/components/ui/Photo";
import {
  categoryBySlug,
  productBySlug,
  subcategoryBySlug,
  productBreadcrumb,
  PRICE_LABEL,
  absoluteUrl,
  PRODUCTS_PATH,
} from "@/lib/catalogue-meta";
import { BreadcrumbNav } from "@/components/catalogue/Breadcrumb";

interface Props {
  params: Promise<{ category: string; subcategory: string; product: string }>;
}

export function generateMetadata({ params }: Props) {
  return params.then(({ category, subcategory, product }) => {
    const cat = categoryBySlug(category);
    const prod = productBySlug(product);
    if (!cat || !prod) return { title: "Product not found" };
    return {
      title: prod.name,
      description: prod.description,
      alternates: { canonical: `/products/${cat.slug}/${subcategory}/${prod.slug}` },
      openGraph: {
        title: prod.name,
        description: prod.description,
        url: `/products/${cat.slug}/${subcategory}/${prod.slug}`,
        type: "website",
      },
    };
  });
}

export default async function ProductPage({ params }: Props) {
  const { category: categorySlug, subcategory: subSlug, product: productSlug } = await params;
  const category = categoryBySlug(categorySlug);
  const product = productBySlug(productSlug);
  const subcategory = subcategoryBySlug(subSlug);

  if (!category || !product || !subcategory) notFound();
  if (subcategory.categorySlug !== categorySlug) notFound();
  if (!product.subcategorySlugs.includes(subSlug)) notFound();

  const breadcrumbs = productBreadcrumb(categorySlug, subSlug, productSlug);
  const submittedAt = new Date().toISOString();

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section
          aria-label={product.name}
          className="relative overflow-hidden bg-cream-50"
        >
          <Leaf className="pointer-events-none absolute -left-16 top-10 h-56 w-56 text-brand-600/10" />
          <Sprig className="pointer-events-none absolute -bottom-8 right-0 h-44 w-44 text-forest-700/10" />

          <Container className="py-12 sm:py-16">
            <BreadcrumbNav items={breadcrumbs} />

            <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
              <Reveal>
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl shadow-forest-900/10">
                  <Photo
                    src={product.image}
                    alt={product.name}
                    tone="botanical"
                    className="h-full w-full"
                  />
                  <div className="absolute left-4 top-4">
                    <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-700 ring-1 ring-neutral-200">
                      {PRICE_LABEL}
                    </span>
                  </div>
                  {product.sku ? (
                    <div className="absolute right-4 top-4">
                      <span
                        className="inline-flex items-center rounded-full bg-forest-900/80 px-3 py-1.5 text-xs font-mono font-medium text-brand-50 ring-1 ring-white/10"
                        title={`Item number: ${product.sku}`}
                      >
                        Item {product.sku}
                      </span>
                    </div>
                  ) : null}
                </div>
              </Reveal>

              <div>
                <Reveal delay={100}>
                  <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                    {category.name}
                  </p>
                  <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
                    {product.name}
                  </h1>

                  <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-brand-50 px-4 py-2 ring-1 ring-brand-200">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-brand-700">
                      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                      <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Price
                      </p>
                      <p className="text-base font-bold text-neutral-900">
                        {PRICE_LABEL}
                      </p>
                    </div>
                  </div>

                  <p className="mt-6 text-lg leading-relaxed text-neutral-700">
                    {product.description}
                  </p>
                </Reveal>

                <Reveal delay={150} className="mt-8">
                  <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      Product details
                    </p>
                    <dl className="mt-4 space-y-3 text-sm">
                      {product.sku ? (
                        <div className="flex justify-between gap-4">
                          <dt className="text-neutral-500">Item number</dt>
                          <dd className="font-mono font-medium text-neutral-900">{product.sku}</dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500">Category</dt>
                        <dd className="font-medium text-neutral-900">{category.name}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500">Availability</dt>
                        <dd className="font-medium text-neutral-900">Contact the office</dd>
                      </div>
                    </dl>
                  </div>
                </Reveal>

                 <Reveal delay={200} className="mt-8">
                   <form action="/register-interest" method="GET" className="space-y-3">
                     <p className="text-sm text-neutral-600">
                       Interested in this product? Tell us a little about yourself
                       and the office team will get back to you.
                     </p>
                     <button
                       type="submit"
                       className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 bg-brand-700 text-white hover:bg-forest-700 shadow-sm shadow-brand-700/25 px-7 py-3.5 text-base"
                     >
                       Interested in this product
                     </button>
                     <input type="hidden" name="product" value={product.name} />
                     <input type="hidden" name="productSku" value={product.sku ?? ""} />
                     <input type="hidden" name="source" value={absoluteUrl(`${PRODUCTS_PATH}/${categorySlug}/${subSlug}/${productSlug}`)} />
                     <input type="hidden" name="submittedAt" value={submittedAt} />
                   </form>
                 </Reveal>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

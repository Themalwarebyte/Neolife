import {
  CATALOGUE_CATEGORIES,
  CATALOGUE_SUBCATEGORIES,
  CATALOGUE_PRODUCTS,
  type CatalogueCategory,
  type CatalogueSubcategory,
  type CatalogueProduct,
} from "@/lib/catalogue-data";

export { CATALOGUE_CATEGORIES, CATALOGUE_SUBCATEGORIES, CATALOGUE_PRODUCTS };
export type { CatalogueCategory, CatalogueSubcategory, CatalogueProduct };

/** Canonical base path for the catalogue. */
export const PRODUCTS_PATH = "/products";

/** Site-wide SEO defaults. */
export const SITE_NAME = "NEOLIFE";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Pricing display constant (Owner-approved decision: "Contact us"). */
export const PRICE_LABEL = "Contact us";

export function buildTitle(parts: string[]): string {
  return `${parts.filter(Boolean).join(" | ")} | ${SITE_NAME}`;
}

export function absoluteUrl(path: string): string {
  const base = SITE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function categoryBySlug(slug: string): CatalogueCategory | undefined {
  return CATALOGUE_CATEGORIES.find((c) => c.slug === slug);
}

export function subcategoryBySlug(slug: string): CatalogueSubcategory | undefined {
  return CATALOGUE_SUBCATEGORIES.find((s) => s.slug === slug);
}

export function productBySlug(slug: string): CatalogueProduct | undefined {
  return CATALOGUE_PRODUCTS.find((p) => p.slug === slug);
}

export function subcategoriesForCategory(categorySlug: string): CatalogueSubcategory[] {
  return CATALOGUE_SUBCATEGORIES.filter((s) => s.categorySlug === categorySlug);
}

export function productsForSubcategory(subcategorySlug: string): CatalogueProduct[] {
  return CATALOGUE_PRODUCTS.filter((p) => p.subcategorySlugs.includes(subcategorySlug));
}

export function productsForCategory(categorySlug: string): CatalogueProduct[] {
  return CATALOGUE_PRODUCTS.filter((p) => p.categorySlugs.includes(categorySlug));
}

export function primarySubcategoryForProduct(
  product: CatalogueProduct,
  categorySlug: string,
): CatalogueSubcategory | undefined {
  return product.subcategorySlugs
    .map((sub) => subcategoryBySlug(sub))
    .filter((s) => s?.categorySlug === categorySlug)[0];
}

export function productUrl(product: CatalogueProduct, categorySlug: string, subcategorySlug?: string): string {
  const sub = subcategorySlug ?? primarySubcategoryForProduct(product, categorySlug)?.slug;
  return sub
    ? `${PRODUCTS_PATH}/${categorySlug}/${sub}/${product.slug}`
    : `${PRODUCTS_PATH}/${categorySlug}/${product.slug}`;
}

export function searchCatalogue(query: string): CatalogueProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATALOGUE_PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q),
  );
}

/** Breadcrumb segments for a catalogue page. */
export type Breadcrumb = { label: string; href: string }[];

export function categoryBreadcrumb(categorySlug: string): Breadcrumb {
  const cat = categoryBySlug(categorySlug);
  return [
    { label: "Products", href: PRODUCTS_PATH },
    { label: cat?.name ?? categorySlug, href: `${PRODUCTS_PATH}/${categorySlug}` },
  ];
}

export function subcategoryBreadcrumb(categorySlug: string, subSlug: string): Breadcrumb {
  const cat = categoryBySlug(categorySlug);
  const sub = subcategoryBySlug(subSlug);
  return [
    { label: "Products", href: PRODUCTS_PATH },
    { label: cat?.name ?? categorySlug, href: `${PRODUCTS_PATH}/${categorySlug}` },
    { label: sub?.name ?? subSlug, href: `${PRODUCTS_PATH}/${categorySlug}/${subSlug}` },
  ];
}

export function productBreadcrumb(categorySlug: string, subcategorySlug: string | undefined, productSlug: string): Breadcrumb {
  const cat = categoryBySlug(categorySlug);
  const sub = subcategorySlug ? subcategoryBySlug(subcategorySlug) : undefined;
  const product = productBySlug(productSlug);
  const crumbs: Breadcrumb = [
    { label: "Products", href: PRODUCTS_PATH },
    { label: cat?.name ?? categorySlug, href: `${PRODUCTS_PATH}/${categorySlug}` },
  ];
  if (subcategorySlug) {
    crumbs.push({ label: sub?.name ?? subcategorySlug, href: `${PRODUCTS_PATH}/${categorySlug}/${subcategorySlug}` });
  }
  crumbs.push({ label: product?.name ?? productSlug, href: `${PRODUCTS_PATH}/${categorySlug}/${subcategorySlug ?? ""}/${productSlug}`.replace(/\/+/g, "/").replace(/\/$/, "") });
  return crumbs;
}
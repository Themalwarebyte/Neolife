import { describe, expect, it } from "vitest";
import {
  CATALOGUE_CATEGORIES,
  CATALOGUE_SUBCATEGORIES,
  CATALOGUE_PRODUCTS,
  searchCatalogue,
} from "@/lib/catalogue-data";
import {
  categoryBySlug,
  subcategoryBySlug,
  productBySlug,
  productsForCategory,
  productsForSubcategory,
  subcategoriesForCategory,
  PRICE_LABEL,
  productUrl,
  primarySubcategoryForProduct,
  productBreadcrumb,
} from "@/lib/catalogue-meta";
import { BreadcrumbNav } from "@/components/catalogue/Breadcrumb";
import { ProductCard } from "@/components/catalogue/ProductCard";

describe("Catalogue data integrity", () => {
  it("exports the four approved top-level categories", () => {
    const slugs = CATALOGUE_CATEGORIES.map((c) => c.slug).sort();
    expect(slugs).toEqual(["home-care", "nutritionals", "personal-care", "weight-management"]);
  });

  it("every category has a unique slug and name", () => {
    const slugs = CATALOGUE_CATEGORIES.map((c) => c.slug);
    const names = CATALOGUE_CATEGORIES.map((c) => c.name);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every subcategory references a known category", () => {
    const categorySlugs = new Set(CATALOGUE_CATEGORIES.map((c) => c.slug));
    for (const sub of CATALOGUE_SUBCATEGORIES) {
      expect(categorySlugs.has(sub.categorySlug)).toBe(true);
    }
  });

  it("every subcategory has a unique (category, slug) pair", () => {
    const pairs = CATALOGUE_SUBCATEGORIES.map((s) => `${s.categorySlug}:${s.slug}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("every product has a unique slug and a non-empty SKU", () => {
    const slugs = CATALOGUE_PRODUCTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const product of CATALOGUE_PRODUCTS) {
      expect(product.sku.length).toBeGreaterThan(0);
    }
  });

  it("every product references at least one category and one subcategory", () => {
    for (const product of CATALOGUE_PRODUCTS) {
      expect(product.categorySlugs.length).toBeGreaterThan(0);
      expect(product.subcategorySlugs.length).toBeGreaterThan(0);
    }
  });

  it("every product category reference resolves to a known category", () => {
    const categorySlugs = new Set(CATALOGUE_CATEGORIES.map((c) => c.slug));
    for (const product of CATALOGUE_PRODUCTS) {
      for (const slug of product.categorySlugs) {
        expect(categorySlugs.has(slug)).toBe(true);
      }
    }
  });

  it("every product subcategory reference resolves to a known subcategory", () => {
    const subSlugs = new Set(CATALOGUE_SUBCATEGORIES.map((s) => s.slug));
    for (const product of CATALOGUE_PRODUCTS) {
      for (const slug of product.subcategorySlugs) {
        expect(subSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("Nutritionals has the approved subcategory tree", () => {
    const subs = subcategoriesForCategory("nutritionals").map((s) => s.slug);
    expect(subs).toContain("nutritional-products");
    expect(subs).toContain("core-products");
    expect(subs).toContain("targeted-solutions");
    expect(subs).toContain("active-lifestyle-and-wellness");
    expect(subs).toContain("oxidative-stress");
    expect(subs).toContain("nutrients-to-support-your-heart");
    expect(subs).toContain("womens-solutions");
    expect(subs).toContain("childrens-nutrition");
    expect(subs).toContain("for-your-bones");
    expect(subs).toContain("aging");
    expect(subs).toContain("herbal-alternatives");
    expect(subs).toContain("neolife-accessories");
  });

  it("Weight Management has the approved subcategory tree", () => {
    const subs = subcategoriesForCategory("weight-management").map((s) => s.slug);
    expect(subs).toEqual(["complementary-product", "protein", "snacks"]);
  });

  it("Personal Care has the approved subcategory tree", () => {
    const subs = subcategoriesForCategory("personal-care").map((s) => s.slug);
    expect(subs).toContain("personal-care-products");
    expect(subs).toContain("organic-skin-care");
    expect(subs).toContain("organic-certified");
    expect(subs).toContain("normal-to-dry-skin");
    expect(subs).toContain("combination-to-oily-skin");
    expect(subs).toContain("hair-care");
    expect(subs).toContain("body-care");
    expect(subs).toContain("nutriance-accessories");
  });

  it("Home Care has the approved subcategory tree", () => {
    const subs = subcategoriesForCategory("home-care").map((s) => s.slug);
    expect(subs).toEqual(["home-care-products", "golden-accessories"]);
  });

  it("resolves known slugs", () => {
    expect(categoryBySlug("nutritionals")?.name).toBe("Nutritionals");
    expect(subcategoryBySlug("core-products")?.name).toBe("Core Products");
    expect(productBySlug("pro-vitality-food-supplement-305")?.name).toBe("Pro Vitality");
    expect(productBySlug("pro-vitality-food-supplement-305")?.sku).toBe("942");
  });

  it("returns undefined for unknown slugs", () => {
    expect(categoryBySlug("does-not-exist")).toBeUndefined();
    expect(subcategoryBySlug("does-not-exist")).toBeUndefined();
    expect(productBySlug("does-not-exist")).toBeUndefined();
  });

  it("productsForCategory returns only products in that category", () => {
    const products = productsForCategory("nutritionals");
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      expect(product.categorySlugs).toContain("nutritionals");
    }
  });

  it("productsForSubcategory returns only products in that subcategory", () => {
    const products = productsForSubcategory("core-products");
    expect(products.length).toBe(2);
    for (const product of products) {
      expect(product.subcategorySlugs).toContain("core-products");
    }
  });

  it("searchCatalogue matches by name, SKU and description", () => {
    const byName = searchCatalogue("Pro Vitality");
    expect(byName.length).toBeGreaterThan(0);
    expect(byName.some((p) => p.name === "Pro Vitality")).toBe(true);

    const bySku = searchCatalogue("942");
    expect(bySku.some((p) => p.sku === "942")).toBe(true);

    const noMatch = searchCatalogue("zzzzzz-not-a-real-product");
    expect(noMatch).toEqual([]);
  });

it("searchCatalogue returns empty for empty queries", () => {
    expect(searchCatalogue("")).toEqual([]);
  });

  it("searchCatalogue returns empty for queries that match nothing", () => {
    expect(searchCatalogue("zzzzzz-not-a-real-product")).toEqual([]);
  });

   it("pricing constant is the approved Contact us label", () => {
    expect(PRICE_LABEL).toBe("Contact us");
  });

  it("every product has an image path", () => {
    for (const product of CATALOGUE_PRODUCTS) {
      expect(product.image).toBeDefined();
      expect(product.image.length).toBeGreaterThan(0);
      expect(product.image.startsWith("/products/")).toBe(true);
      expect(product.image.endsWith("/product.webp")).toBe(true);
    }
  });

  it("every product image path matches the product slug", () => {
    for (const product of CATALOGUE_PRODUCTS) {
      expect(product.image).toBe(`/products/${product.slug}/product.webp`);
    }
  });
});

describe("Product URL routing", () => {
  it("productUrl includes a subcategory segment when none provided", () => {
    const product = productBySlug("pro-vitality-food-supplement-305")!;
    const url = productUrl(product, "nutritionals");
    expect(url.startsWith("/products/nutritionals/")).toBe(true);
    expect(url.endsWith("/pro-vitality-food-supplement-305")).toBe(true);
  });

  it("productUrl uses the provided subcategory", () => {
    const product = productBySlug("pro-vitality-food-supplement-305")!;
    const url = productUrl(product, "nutritionals", "core-products");
    expect(url).toBe("/products/nutritionals/core-products/pro-vitality-food-supplement-305");
  });

  it("primarySubcategoryForProduct returns a subcategory belonging to the given category", () => {
    const product = productBySlug("pro-vitality-food-supplement-305")!;
    const sub = primarySubcategoryForProduct(product, "nutritionals");
    expect(sub).toBeDefined();
    expect(sub!.categorySlug).toBe("nutritionals");
  });

  it("productBreadcrumb includes the subcategory segment", () => {
    const crumbs = productBreadcrumb("nutritionals", "core-products", "pro-vitality-food-supplement-305");
    expect(crumbs.length).toBe(4);
    expect(crumbs[3].href).toContain("/core-products/pro-vitality-food-supplement-305");
  });

  it("productBreadcrumb works without a subcategory (fallback)", () => {
    const crumbs = productBreadcrumb("nutritionals", undefined, "pro-vitality-food-supplement-305");
    expect(crumbs.length).toBe(3);
    expect(crumbs[2].href).toContain("/pro-vitality-food-supplement-305");
  });
});

describe("Catalogue components", () => {
  it("ProductCard renders the product name and price label", () => {
    const product = productBySlug("pro-vitality-food-supplement-305")!;
    const card = ProductCard({ product, categorySlug: "nutritionals" });
    expect(card).toBeTruthy();
  });

it("BreadcrumbNav renders nothing for a single item", () => {
    const nav = BreadcrumbNav({ items: [{ label: "Products", href: "/products" }] });
    expect(nav).toBeNull();
  });

  it("BreadcrumbNav renders a multi-item trail", () => {
    const nav = BreadcrumbNav({
      items: [
        { label: "Products", href: "/products" },
        { label: "Nutritionals", href: "/products/nutritionals" },
      ],
    });
    expect(nav).toBeTruthy();
  });
});

/**
 * Seed the NEOLIFE product catalogue (idempotent).
 *
 * Upserts categories, subcategories, products, and their join tables from
 * src/lib/catalogue-data.ts. Safe to re-run: existing rows are updated and
 * no rows are deleted.
 *
 * Usage:
 *   $env:DATABASE_URL="postgresql://..."; pnpm exec tsx scripts/seed-catalogue.ts
 */

import { prisma } from "../src/server/db/prisma";
import {
  CATALOGUE_CATEGORIES,
  CATALOGUE_SUBCATEGORIES,
  CATALOGUE_PRODUCTS,
} from "../src/lib/catalogue-data";

async function main() {
  const categoryIds = new Map<string, string>();
  const subcategoryIds = new Map<string, string>();

  // 1. Categories (upsert by slug)
  for (const category of CATALOGUE_CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        displayOrder: category.displayOrder,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        displayOrder: category.displayOrder,
      },
    });
    categoryIds.set(category.slug, row.id);
  }

  // 2. Subcategories (upsert by category slug + subcategory slug)
  for (const sub of CATALOGUE_SUBCATEGORIES) {
    const categoryId = categoryIds.get(sub.categorySlug);
    if (!categoryId) {
      throw new Error(`Category not found for subcategory: ${sub.slug}`);
    }
    const row = await prisma.subcategory.upsert({
      where: { categoryId_slug: { categoryId, slug: sub.slug } },
      update: {
        name: sub.name,
        description: sub.description,
        displayOrder: sub.displayOrder,
      },
      create: {
        name: sub.name,
        slug: sub.slug,
        categoryId,
        description: sub.description,
        displayOrder: sub.displayOrder,
      },
    });
    subcategoryIds.set(sub.slug, row.id);
  }

  // 3. Products (upsert by slug)
  for (const product of CATALOGUE_PRODUCTS) {
    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        sku: product.sku,
        description: product.description,
        displayOrder: product.displayOrder,
      },
      create: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        description: product.description,
        displayOrder: product.displayOrder,
      },
    });

    // Join: categories
    for (const categorySlug of product.categorySlugs) {
      const categoryId = categoryIds.get(categorySlug);
      if (!categoryId) {
        throw new Error(`Category not found: ${categorySlug}`);
      }
      await prisma.productCategory.upsert({
        where: { productId_categoryId: { productId: row.id, categoryId } },
        update: {},
        create: { productId: row.id, categoryId },
      });
    }

    // Join: subcategories
    for (const subSlug of product.subcategorySlugs) {
      const subId = subcategoryIds.get(subSlug);
      if (!subId) {
        throw new Error(`Subcategory not found: ${subSlug}`);
      }
      await prisma.productSubcategory.upsert({
        where: { productId_subcategoryIds: { productId: row.id, subcategoryIds: subId } },
        update: {},
        create: { productId: row.id, subcategoryIds: subId },
      });
    }
  }

  const [categoryCount, subCount, productCount] = await Promise.all([
    prisma.category.count(),
    prisma.subcategory.count(),
    prisma.product.count(),
  ]);

  console.log(
    `Catalogue seeded: ${categoryCount} categories, ${subCount} subcategories, ${productCount} products`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogueSubcategory } from "@/lib/catalogue-data";

/**
 * Lightweight client-side subcategory filter.
 *
 * No external search engine, no new infrastructure. Filtering is performed
 * in-memory against the pre-rendered product grid, which is sufficient for
 * the current catalogue size and keeps the page fully server-rendered.
 */
export function SubcategoryFilter({
  subcategories,
  activeSlug,
  categorySlug,
}: {
  subcategories: CatalogueSubcategory[];
  activeSlug: string | null;
  categorySlug: string;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the visible chips in sync when the route changes.
  useEffect(() => {
    setQuery("");
  }, [activeSlug]);

  const visible = query.trim().length === 0
    ? subcategories
    : subcategories.filter((s) =>
        s.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        s.slug.toLowerCase().includes(query.trim().toLowerCase()),
      );

  return (
    <div className="mb-8">
      <label htmlFor="subcategory-search" className="sr-only">
        Filter subcategories
      </label>
      <input
        ref={inputRef}
        id="subcategory-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter subcategories…"
        className="mb-4 w-full max-w-md rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        aria-label="Filter subcategories"
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/products/${categorySlug}`}
          className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            activeSlug === null
              ? "bg-brand-700 text-white"
              : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-brand-50 hover:text-brand-700"
          }`}
          aria-current={activeSlug === null ? "page" : undefined}
        >
          All
        </Link>
        {visible.map((sub) => (
          <Link
            key={sub.slug}
            href={`/products/${categorySlug}/${sub.slug}`}
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              activeSlug === sub.slug
                ? "bg-brand-700 text-white"
                : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-brand-50 hover:text-brand-700"
            }`}
            aria-current={activeSlug === sub.slug ? "page" : undefined}
          >
            {sub.name}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          No subcategories match &ldquo;{query}&rdquo;.
        </p>
      ) : null}
    </div>
  );
}
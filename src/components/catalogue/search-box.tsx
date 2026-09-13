"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchCatalogue } from "@/lib/catalogue-data";
import { productUrl } from "@/lib/catalogue-meta";

/**
 * Lightweight catalogue search box.
 *
 * No external search engine, no new infrastructure. Performs an in-memory
 * match across name, SKU and description. Results are rendered as links to
 * the product detail page.
 */
export function CatalogueSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = query.trim().length >= 2 ? searchCatalogue(query).slice(0, 8) : [];

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery("");
          setOpen(false);
        }}
      >
        <label htmlFor="catalogue-search" className="sr-only">
          Search products
        </label>
        <div className="relative">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
            <path
              d="M13 13l4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            id="catalogue-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(e.target.value.trim().length >= 2);
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true);
            }}
            placeholder="Search products..."
            className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-72"
            aria-label="Search products"
            aria-expanded={open}
            aria-controls="catalogue-search-results"
          />
        </div>
      </form>

      {open ? (
        <div
          id="catalogue-search-results"
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">
              No products match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul>
              {results.map((product) => (
                <li key={product.slug}>
                   <Link
                     href={productUrl(product, product.categorySlugs[0] ?? "")}
                     className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50"
                    onClick={() => {
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="M4 16V4a2 2 0 012-2h8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M4 4h12v12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {product.name}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {product.sku ? `SKU ${product.sku}` : "Product"}
                      </p>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { Photo } from "@/components/ui/Photo";
import { PRICE_LABEL, productUrl, PRODUCTS_PATH } from "@/lib/catalogue-meta";
import type { CatalogueProduct } from "@/lib/catalogue-data";

type ProductCardProps = {
  product: CatalogueProduct;
  categorySlug: string;
  subcategorySlug?: string;
  index?: number;
};

/**
 * Reusable product card.
 */
export function ProductCard({ product, categorySlug, subcategorySlug, index = 0 }: ProductCardProps) {
  const href = productUrl(product, categorySlug, subcategorySlug);

  return (
    <Reveal delay={index * 60} className="h-full">
      <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-forest-900/10">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Photo
            src={product.image}
            alt={product.name}
            tone="botanical"
            className="h-full w-full"
          />
          <div className="absolute left-3 top-3">
            <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700 ring-1 ring-neutral-200">
              {PRICE_LABEL}
            </span>
          </div>
          {product.sku ? (
            <div className="absolute right-3 top-3">
              <span
                className="inline-flex items-center rounded-full bg-forest-900/70 px-2.5 py-1 text-[11px] font-mono font-medium text-brand-50 ring-1 ring-white/10"
                title={`Item number: ${product.sku}`}
              >
                SKU {product.sku}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="text-base font-bold leading-snug text-neutral-900 transition-colors group-hover:text-brand-700">
            {product.name}
          </h3>
          {product.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">
              {product.description}
            </p>
          ) : null}

          <div className="mt-auto pt-4">
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-forest-700"
            >
              View details
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path
                  d="M4 10h12M12 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

/** Empty-state card for "no products in this view". */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50/60 px-6 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"
        aria-hidden="true"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3v18M3 12h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="mt-4 text-base font-medium text-neutral-700">{message}</p>
        <Link
          href={PRODUCTS_PATH}
          className="mt-3 inline-flex items-center text-sm font-semibold text-brand-700 hover:text-forest-700"
        >
        Browse all products
      </Link>
    </div>
  );
}

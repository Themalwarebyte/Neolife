import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Container } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Leaf, Sprig } from "@/components/ui/Botanical";
import { QualificationForm } from "@/components/leads/QualificationForm";
import {
  RegistrationForm,
  type SelectableProduct,
} from "@/components/leads/RegistrationForm";
import { prisma } from "@/server/db/prisma";
import { CATALOGUE_CATEGORIES } from "@/lib/catalogue-data";

export const metadata: Metadata = {
  title: "Qualify Your Interest — NEOLIFE",
  description:
    "Tell us more about your interest in the NEOLIFE business opportunity.",
};

/**
 * Fetches the first product per category group from the database for the
 * registration-interest form (D-026). Returns an empty array if the catalogue
 * has not been seeded yet.
 */
async function getFeaturedProducts(): Promise<SelectableProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      categories: {
        some: {
          category: {
            slug: { in: CATALOGUE_CATEGORIES.map((c) => c.slug) },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      displayOrder: true,
    },
    orderBy: { displayOrder: "asc" },
    take: 20,
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
    image: p.imageUrl ?? null,
  }));
}

/**
 * Phase D — post-capture qualification flow (D-030).
 *
 * The token query parameter contains a signed, single-use qualification
 * continuation token. It grants the prospect the ability to update only
 * their own lead's qualification fields.
 *
 * The token is validated server-side by the QualificationForm component /
 * its Server Action — it is not trusted client-side.
 *
 * This page also includes the optional Registration/Business-Interest form
 * (D-026 capture flow) which uses the same token for authorization (non-consuming).
 */
export default async function QualifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const featuredProducts = await getFeaturedProducts();

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden bg-cream-50 py-16 sm:py-20">
          <Leaf className="pointer-events-none absolute -left-16 top-8 h-56 w-56 text-brand-600/8" />
          <Sprig className="pointer-events-none absolute -bottom-8 right-0 h-44 w-44 text-forest-700/8" />
          <Container className="py-0">
            <div className="mx-auto max-w-2xl">
              <Reveal>
                <div className="text-center">
                  <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                    Qualification
                  </p>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                    Tell us more about your interest
                  </h1>
                  <p className="mt-4 text-lg text-neutral-600">
                    This helps our office team give you the most relevant
                    information about the NEOLIFE opportunity.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={100}>
                <div className="mt-10 rounded-3xl border border-neutral-100 bg-white p-6 shadow-xl shadow-neutral-900/5 sm:p-10">
                  <Suspense fallback={<QualificationLoading />}>
                    <QualificationForm token={token ?? ""} />
                  </Suspense>
                </div>
              </Reveal>

              {/* Phase P-1 — optional registration / business-interest form (D-026) */}
              <Reveal delay={200}>
                <div className="mt-10 rounded-3xl border border-neutral-100 bg-white p-6 shadow-xl shadow-neutral-900/5 sm:p-10">
                  <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-brand-600">
                    Product interest
                  </h2>
                  <p className="mt-3 text-center text-sm text-neutral-600">
                    Optionally let us know which product you are most curious
                    about and how you'd prefer to meet.
                  </p>
                  <div className="mt-6">
                    <Suspense fallback={<RegistrationLoading />}>
                      <RegistrationForm
                        token={token ?? ""}
                        products={featuredProducts}
                      />
                    </Suspense>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={300}>
                <p className="mt-6 text-center text-sm text-neutral-500">
                  <Link href="/" className="text-brand-700 hover:underline">
                    Return to the home page
                  </Link>
                  . No obligation, ever.
                </p>
              </Reveal>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function QualificationLoading() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-200" />
    </div>
  );
}

function RegistrationLoading() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-20 w-full animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-10 w-full animate-pulse rounded-full bg-neutral-200" />
    </div>
  );
}

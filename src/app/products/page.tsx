import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { ProductsSection } from "@/components/landing/ProductsSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { OpportunitySection } from "@/components/landing/OpportunitySection";
import { SupportSection } from "@/components/landing/SupportSection";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { CatalogueHero } from "@/components/catalogue/hero";
import { CategoryGrid } from "@/components/catalogue/category-grid";
import { CatalogueSearch } from "@/components/catalogue/search-box";
import { Container } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "NEOLIFE Products — Browse Our Range",
  description:
    "Browse the NEOLIFE product range: Nutritionals, Weight Management, Personal Care and Home Care. Find a product and tell us you are interested.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "NEOLIFE Products",
    description: "Browse the NEOLIFE product range and tell us you are interested in a product.",
    url: "/products",
    type: "website",
  },
};

export default function ProductsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <CatalogueHero />
        <CategoryGrid />
        <section id="catalogue-search" className="bg-cream-50 py-10 sm:py-12">
          <Container className="flex justify-center">
            <div className="w-full max-w-2xl">
              <CatalogueSearch />
            </div>
          </Container>
        </section>
        <ProductsSection />
        <OpportunitySection />
        <HowItWorksSection />
        <SupportSection />
        <TrustStrip />
        <FaqSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
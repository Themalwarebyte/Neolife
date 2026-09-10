import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { OpportunitySection } from "@/components/landing/OpportunitySection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { ProductsSection } from "@/components/landing/ProductsSection";
import { SupportSection } from "@/components/landing/SupportSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaSection } from "@/components/landing/CtaSection";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <TrustStrip />
        <OpportunitySection />
        <HowItWorksSection />
        <ProductsSection />
        <SupportSection />
        <FaqSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}


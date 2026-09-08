import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { OpportunitySection } from "@/components/landing/OpportunitySection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { SupportSection } from "@/components/landing/SupportSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaSection } from "@/components/landing/CtaSection";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <OpportunitySection />
        <HowItWorksSection />
        <SupportSection />
        <FaqSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}

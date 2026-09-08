import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { OpportunitySection } from "@/components/landing/OpportunitySection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaSection } from "@/components/landing/CtaSection";

/**
 * Task 1.4 — reusable campaign landing-page capability.
 *
 * Any URL of the form `/campaign/<campaign-name>` serves the approved
 * business-opportunity presentation (Task 1.3 visual system — no separate
 * design system, no invented per-campaign marketing content).
 *
 * Example paid-ad destination:
 *   /campaign/launch?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch
 *
 * Attribution is captured first-party by `AttributionCapture` (root layout) and
 * attached to the lead submitted via /register-interest.
 */

const CAMPAIGN_SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaign: string }>;
}): Promise<Metadata> {
  const { campaign } = await params;
  if (!CAMPAIGN_SLUG.test(campaign)) return { title: "NEOLIFE" };
  return {
    title: `NEOLIFE Business Opportunity — ${campaign}`,
    description:
      "Learn about the NEOLIFE business opportunity. Register your interest and meet the team.",
  };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaign: string }>;
}) {
  const { campaign } = await params;

  // Untrusted path segment: constrain before any use.
  if (!CAMPAIGN_SLUG.test(campaign)) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <OpportunitySection />
        <HowItWorksSection />
        <FaqSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}

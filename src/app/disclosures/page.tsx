import type { Metadata } from "next";
import { InfoPageLayout, InfoSection } from "@/components/layout/InfoPageLayout";

export const metadata: Metadata = { title: "Disclosures — NEOLIFE" };

export default function DisclosuresPage() {
  return (
    <InfoPageLayout
      title="Disclosures"
      updatedLabel="DRAFT — pending Owner/legal review. Not final or legally approved text."
    >
      <InfoSection heading="Business relationship disclosure">
        <p>
          This website is operated by an independent NEOLIFE business
          (distributor / business builder). It is not the official NeoLife
          corporate website, and it is not the official NeoLife
          distributor-registration system. Any reference to NEOLIFE or NeoLife
          products is made by an independent business.
          {/* OWNER/LEGAL REVIEW — confirm exact relationship wording. */}
        </p>
      </InfoSection>

      <InfoSection heading="Earnings and results disclosure">
        <p>
          No income, earnings or business results are promised or guaranteed.
          Individual results depend on many factors including personal effort,
          experience and skill, and will vary. This website does not publish
          typical or average earnings figures, and we do not make any claim about
          how much you may earn. Running a business can involve costs or
          expenses.
          {/* OWNER/LEGAL REVIEW — final earnings disclosure wording. */}
        </p>
      </InfoSection>

      <InfoSection heading="Not employment">
        <p>
          The opportunity described on this website is a business opportunity,
          not employment. Nothing on this website constitutes an offer of
          employment.
        </p>
      </InfoSection>

      <InfoSection heading="Product and medical disclaimer">
        <p>
          Product information on this website is general in nature. It is not
          medical advice, and our products are not presented as a treatment, cure
          or prevention of any disease or medical condition. No therapeutic or
          disease-treatment claims are made. Please consult a qualified health
          professional for any medical questions.
          {/* OWNER/LEGAL REVIEW — final product/medical disclaimer wording. */}
        </p>
      </InfoSection>

      <InfoSection heading="Advertising and tracking">
        <p>
          This website uses first-party attribution (UTM parameters and
          first-touch attribution) to understand which advertisement brought a
          visitor here. It does not use Meta Pixel, Google Analytics (GA4), or any
          other third-party advertising or analytics tracker.
        </p>
      </InfoSection>

      <InfoSection heading="Status of these disclosures">
        <p>
          These disclosures are a draft provided for review. Final approved
          wording will be supplied by the Owner/legal before any advertising
          launch.
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}

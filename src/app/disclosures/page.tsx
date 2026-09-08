import type { Metadata } from "next";
import { InfoPageLayout, InfoSection } from "@/components/layout/InfoPageLayout";

export const metadata: Metadata = { title: "Disclosures — NEOLIFE" };

export default function DisclosuresPage() {
  return (
    <InfoPageLayout title="Disclosures">
      <InfoSection heading="Business relationship">
        <p>
          {/* OWNER/LEGAL REVIEW — exact relationship identification wording. */}
          This website is operated by an independent NEOLIFE business (distributor /
          business builder). It is not the official NeoLife corporate website.
        </p>
      </InfoSection>
      <InfoSection heading="Earnings and results">
        <p>
          No income, earnings or business results are promised or guaranteed.
          Any individual results depend on many factors including personal
          effort, experience and skill, and will vary.
        </p>
      </InfoSection>
      <InfoSection heading="Product information">
        <p>
          Product information on this website is general in nature. It is not
          medical advice, and our products are not presented as treatment,
          cure or prevention of any condition. Consult a qualified health
          professional for medical questions.
        </p>
      </InfoSection>
      <InfoSection heading="Status of these disclosures">
        <p>
          These disclosures are a structural placeholder. Final approved wording
          will be provided by the Owner/legal before any advertising launch.
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}

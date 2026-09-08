import type { Metadata } from "next";
import { InfoPageLayout, InfoSection } from "@/components/layout/InfoPageLayout";

export const metadata: Metadata = { title: "Terms of Use — NEOLIFE" };

export default function TermsPage() {
  return (
    <InfoPageLayout title="Terms of Use">
      <InfoSection heading="About this website">
        <p>
          This website provides information about a business opportunity and is
          operated by an independent NEOLIFE business. It is not the official
          NeoLife corporate website.
        </p>
      </InfoSection>
      <InfoSection heading="Information only">
        <p>
          Content on this website is for general information. It is not
          financial, legal, medical or professional advice.
        </p>
      </InfoSection>
      <InfoSection heading="No guarantees">
        <p>
          {/* OWNER/LEGAL REVIEW — final compliance wording. */}
          Business results vary and depend on individual effort, experience and
          skill. Nothing on this website is a promise or guarantee of income or
          business results.
        </p>
      </InfoSection>
      <InfoSection heading="Status of these terms">
        <p>
          These terms are a structural placeholder. Final approved wording will
          be provided by the Owner/legal before any advertising launch.
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}

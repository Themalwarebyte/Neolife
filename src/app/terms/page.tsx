import type { Metadata } from "next";
import { InfoPageLayout, InfoSection } from "@/components/layout/InfoPageLayout";

export const metadata: Metadata = { title: "Terms of Use — NEOLIFE" };

export default function TermsPage() {
  return (
    <InfoPageLayout
      title="Terms of Use"
      updatedLabel="DRAFT — pending Owner/legal review. Not final or legally approved text."
    >
      <InfoSection heading="About this website">
        <p>
          This website provides information about a business opportunity and is
          operated by an independent NEOLIFE business (distributor / business
          builder). It is not the official NeoLife corporate website, and it is
          not the official NeoLife distributor-registration system.
        </p>
      </InfoSection>

      <InfoSection heading="Acceptance of these terms">
        <p>
          By using this website, you agree to these terms. If you do not agree,
          please do not use the website.
        </p>
      </InfoSection>

      <InfoSection heading="Information only">
        <p>
          Content on this website is for general information only. It is not
          financial, legal, medical or professional advice. You should seek
          independent advice before making business or financial decisions.
        </p>
      </InfoSection>

      <InfoSection heading="No guarantees of income or results">
        <p>
          Nothing on this website is a promise, guarantee or representation of
          income, earnings or business results. Individual results depend on many
          factors including your own effort, experience and skill, and they vary.
          Running a business can involve costs or expenses.
          {/* OWNER/LEGAL REVIEW — final compliance wording. */}
        </p>
      </InfoSection>

      <InfoSection heading="No employment relationship">
        <p>
          This website describes a business opportunity, not employment. Registering
          your interest does not create an employment relationship with us.
        </p>
      </InfoSection>

      <InfoSection heading="Acceptable use">
        <p>
          You agree not to misuse this website, attempt to gain unauthorised
          access to any part of it, or use it to submit false, misleading or
          unlawful information.
        </p>
      </InfoSection>

      <InfoSection heading="Changes and contact">
        <p>
          We may update these terms from time to time. The version published on
          this website is the current version. Questions can be directed to the
          office using the contact details on this website.
          {/* OWNER DECISION PENDING: supply the office contact details. */}
        </p>
      </InfoSection>

      <InfoSection heading="Governing law">
        <p>
          These terms are governed by the laws of Kenya.
          {/* OWNER/LEGAL REVIEW — confirm governing-law and dispute-resolution wording. */}
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}

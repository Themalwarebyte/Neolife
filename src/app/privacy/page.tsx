import type { Metadata } from "next";
import { InfoPageLayout, InfoSection } from "@/components/layout/InfoPageLayout";

export const metadata: Metadata = { title: "Privacy Notice — NEOLIFE" };

export default function PrivacyPage() {
  return (
    <InfoPageLayout title="Privacy Notice">
      <InfoSection heading="What we collect">
        <p>
          {/* OWNER/LEGAL REVIEW — align with approved lead form fields (Task 1.5). */}
          When you register your interest, we collect the details you provide —
          such as your name, phone number, email and your area — so that we can
          contact you about the business opportunity. We keep a record of your
          consent and when it was given.
        </p>
      </InfoSection>
      <InfoSection heading="Why we collect it">
        <p>
          We use your details only to respond to your enquiry, answer your
          questions, arrange meetings and follow up on the business
          information you asked about.
        </p>
      </InfoSection>
      <InfoSection heading="Your choices">
        <p>
          {/* OWNER/LEGAL REVIEW — final data-protection wording, incl. Kenya Data Protection Act 2019 context. */}
          You may ask us to correct or delete your details at any time, or ask
          us to stop contacting you. Contact the office using the details on
          this website.
        </p>
      </InfoSection>
      <InfoSection heading="Status of this notice">
        <p>
          This notice is a structural placeholder. Final approved wording will
          be provided by the Owner/legal before any advertising launch.
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}

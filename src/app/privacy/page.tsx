import type { Metadata } from "next";
import { InfoPageLayout, InfoSection } from "@/components/layout/InfoPageLayout";

export const metadata: Metadata = { title: "Privacy Notice — NEOLIFE" };

export default function PrivacyPage() {
  return (
    <InfoPageLayout
      title="Privacy Notice"
      updatedLabel="MVP legal baseline — subject to future revision. Not legal advice."
    >
      <InfoSection heading="Who we are">
        <p>
          This website is operated by an independent NEOLIFE business
          (distributor / business builder). It is not the official NeoLife
          corporate website. We are the data controller for the information
          collected through this website.
        </p>
      </InfoSection>

      <InfoSection heading="Information we collect">
        <p>When you register your interest, we collect the details you provide:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Your name</li>
          <li>Your phone number</li>
          <li>Your email address (optional)</li>
          <li>Your city or area (optional)</li>
          <li>What you are interested in (the business, the products, or both)</li>
        </ul>
        <p className="mt-3">
          We also record the marketing information that tells us how you reached
          us (first-party attribution): the UTM source, medium, campaign, content
          and term from the link you clicked, the landing page you arrived on, and
          the first source that brought you here. We do not collect any
          information that is not necessary to respond to your enquiry.
        </p>
      </InfoSection>

      <InfoSection heading="How we collect it">
        <p>
          Your details are collected when you submit the interest form. The
          marketing/attribution information is captured from the link you clicked
          and stored locally on your own device (in your browser&apos;s local
          storage), then sent to us only when you submit the form. We do not use
          advertising cookies, and we do not use device fingerprinting.
        </p>
      </InfoSection>

      <InfoSection heading="How we use it">
        <p>We use your information only to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Respond to your enquiry about the business opportunity</li>
          <li>Contact you to answer your questions</li>
          <li>Arrange and manage meetings at our office</li>
          <li>Follow up with you, if you have asked us to</li>
          <li>Keep internal office records (CRM) so we can serve you properly</li>
        </ul>
        <p className="mt-3">
          We do not sell your information and do not share it with third parties
          for their own marketing.
        </p>
      </InfoSection>

      <InfoSection heading="Consent">
        <p>
          We ask for your consent before you submit your details, and we keep a
          record of that consent together with the date and time it was given.
          You may withdraw your consent at any time by contacting the office; we
          will then stop contacting you.
        </p>
      </InfoSection>

      <InfoSection heading="Who can access it">
        <p>
          Your information is only accessible to authorised office/administrative
          staff through a password-protected, restricted area of this website
          (the CRM). It is not publicly visible.
        </p>
      </InfoSection>

      <InfoSection heading="How long we keep it & your rights">
        <p>
          We keep your information for as long as it is needed to manage your
          enquiry and our business relationship with you, after which it is
          deleted or anonymised.
          {/* OWNER/LEGAL REVIEW — confirm retention period and Kenya Data Protection Act 2019 specifics. */}
        </p>
        <p className="mt-2">
          You may ask us to correct your information, delete it, or stop
          contacting you at any time by contacting the office. We will act on
          your request as required by law.
        </p>
      </InfoSection>

      <InfoSection heading="No third-party advertising trackers">
        <p>
          This website does not use Meta Pixel, Google Analytics (GA4), or any
          other third-party advertising or analytics trackers. Attribution is
          first-party only.
        </p>
      </InfoSection>

      <InfoSection heading="Contact">
        <p>
          To exercise your rights or ask a question, contact the office using the
          contact details shown on this website.
          {/* OWNER DECISION PENDING: supply the office contact details. */}
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}

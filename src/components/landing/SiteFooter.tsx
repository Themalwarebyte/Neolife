import Link from "next/link";
import { Container } from "@/components/ui/Section";

/*
  Compliance note: footer disclosure wording below is intentionally
  conservative; it is the current MVP legal baseline, subject to future
  Owner/legal revision (§14, §11.6 gate). Not final legal advice.
*/
export function SiteFooter() {
  return (
    <footer className="bg-forest-900 text-brand-50/80">
      <Container className="grid gap-10 py-14 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-white">
            NEO<span className="text-brand-400">LIFE</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-brand-50/60">
            {/* MVP baseline — subject to future revision: business-relationship wording */}
            This website is operated by an independent NEOLIFE business
            (distributor / business builder). It is not the official NeoLife
            corporate website or the official NeoLife distributor-registration
            system.
          </p>
        </div>

        <nav aria-label="Legal and information">
          <p className="text-sm font-semibold text-white">Information</p>
          <ul className="mt-3 space-y-2 text-sm text-brand-50/60">
            <li>
              <Link href="/#opportunity" className="hover:text-brand-300">
                The Opportunity
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="hover:text-brand-300">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-brand-300">
                Privacy Notice
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-brand-300">
                Terms of Use
              </Link>
            </li>
            <li>
              <Link href="/disclosures" className="hover:text-brand-300">
                Disclosures
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold text-white">Office</p>
          {/* OWNER DECISION PENDING: real office contact details must be supplied by the Owner */}
          <p className="mt-3 text-sm text-brand-50/60">
            Nairobi, Kenya — office contact details to be confirmed.
          </p>
          <Link
            href="/register-interest"
            className="mt-3 inline-block text-sm font-semibold text-brand-300 hover:underline"
          >
            Register your interest →
          </Link>
        </div>
      </Container>

      <div className="border-t border-forest-700/60">
        <Container className="py-5">
          <p className="text-xs leading-relaxed text-brand-100/50">
            {/* MVP baseline — subject to future revision: no income or health claims permitted. */}
            Results in any business vary and depend on individual effort,
            experience and skill. Nothing on this website is a promise,
            guarantee or representation of income or business results, and
            running a business can involve costs or expenses. This is a business
            opportunity, not employment, and nothing here is medical advice. This
            website does not use third-party advertising trackers.
          </p>
        </Container>
      </div>
    </footer>
  );
}


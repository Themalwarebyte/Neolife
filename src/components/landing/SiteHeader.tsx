import Link from "next/link";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container } from "@/components/ui/Section";

const navItems = [
  { href: "/#opportunity", label: "The Opportunity" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#support", label: "Support" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * Public site header. Reused by future campaign landing pages.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-100 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-lg font-extrabold tracking-tight text-neutral-900"
          aria-label="NEOLIFE — home"
        >
          NEO<span className="text-brand-600">LIFE</span>
          <span className="ml-2 hidden text-xs font-medium uppercase tracking-widest text-neutral-400 sm:inline">
            Business Opportunity
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden md:block">
          <ul className="flex items-center gap-7 text-sm font-medium text-neutral-600">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-colors hover:text-brand-700"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <CtaLink href="/register-interest" size="md" className="hidden sm:inline-flex">
            Register Interest
          </CtaLink>
          {/* Mobile navigation (no JavaScript required) */}
          <details className="relative md:hidden">
            <summary
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg ring-1 ring-neutral-200"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M3 5h14M3 10h14M3 15h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="text-neutral-700"
                />
              </svg>
            </summary>
            <nav
              aria-label="Mobile navigation"
              className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-100 bg-white p-2 shadow-lg"
            >
              <ul className="text-sm font-medium text-neutral-700">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-lg px-3 py-2 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/register-interest"
                    className="mt-1 block rounded-lg bg-brand-700 px-3 py-2 text-center font-semibold text-white hover:bg-forest-700"
                  >
                    Register Interest
                  </Link>
                </li>
              </ul>
            </nav>
          </details>
        </div>
      </Container>
    </header>
  );
}

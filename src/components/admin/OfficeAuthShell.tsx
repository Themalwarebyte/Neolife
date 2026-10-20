import Link from "next/link";

/** Shared layout for sign-in, password recovery, and forced password change. */
export function OfficeAuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="office-auth min-h-[calc(100svh-4rem)] text-mulberry-900">
      <div className="office-auth-orb office-auth-orb-one" aria-hidden="true" />
      <div className="office-auth-orb office-auth-orb-two" aria-hidden="true" />
      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1440px] grid-cols-1 items-center lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
        <section className="hidden px-14 py-16 text-white lg:block xl:px-20" aria-label="NEOLIFE Office introduction">
          <Link href="/" className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold tracking-[0.14em] text-white transition hover:bg-white/20 focus-visible:outline-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg" aria-hidden="true">✦</span>
            NEOLIFE
            <span className="text-mulberry-200">OFFICE</span>
          </Link>
          <div className="mt-20 max-w-xl">
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-mulberry-200"><span className="h-2 w-2 rounded-full bg-mulberry-300" /> Your people. Your progress.</p>
            <h2 className="text-balance text-5xl font-extrabold leading-[1.08] tracking-tight xl:text-6xl">Everything that matters, <span className="office-auth-highlight">beautifully connected.</span></h2>
            <p className="mt-7 max-w-lg text-lg leading-8 text-mulberry-100/90">A calmer way to manage leads, referrals, conversations and follow-ups—securely in one place.</p>
            <div className="mt-14 grid max-w-md grid-cols-2 gap-3" aria-label="Workspace capabilities">
              <div className="office-auth-feature"><span aria-hidden="true">◎</span><p>Lead management</p></div>
              <div className="office-auth-feature"><span aria-hidden="true">↗</span><p>Referral journeys</p></div>
              <div className="office-auth-feature"><span aria-hidden="true">✳</span><p>Team coordination</p></div>
              <div className="office-auth-feature"><span aria-hidden="true">◈</span><p>Secure access</p></div>
            </div>
          </div>
          <p className="mt-20 text-sm text-mulberry-200/80">Designed for the NEOLIFE team.</p>
        </section>

        <section className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-4 py-12 sm:px-8 lg:py-16" aria-label="Office account access">
          <div className="w-full max-w-[510px]">
            <Link href="/" className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold tracking-wide text-white transition hover:bg-white/20 lg:hidden">✦ NEOLIFE OFFICE</Link>
            <div className="office-auth-card p-7 sm:p-10">
              <div className="mb-8">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mulberry-50 text-2xl text-mulberry-700" aria-hidden="true">✦</div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-mulberry-600">{eyebrow}</p>
                <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-mulberry-900 sm:text-4xl">{title}</h1>
                <p className="mt-3 text-sm leading-7 text-neutral-600">{description}</p>
              </div>
              {children}
            </div>
            <div className="mt-6 flex items-center justify-between gap-4 px-2 text-xs text-white/85">
              <span>Private team workspace</span>
              <Link href="/" className="font-semibold underline decoration-white/30 underline-offset-4 transition hover:decoration-white">Back to website</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

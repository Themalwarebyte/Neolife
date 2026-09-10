# NEOLIFE — Public Website Visual/Conversion Upgrade Plan

> **OWNER-APPROVED direction (planned; NOT implemented).**
> Benchmark: Semrush-level UX polish. Visual identity: NeoLife botanical/wellness (leaves, herbs, nutrition, nature). Not a copy of Semrush or NeoLife assets.
>
> Status: ⚪ NOT STARTED · Public UI/UX only — no backend, funnel, auth, CRM, or infra changes.

## 1. Current homepage section inventory
`src/app/page.tsx` renders, in order: `SiteHeader` → `Hero` → `OpportunitySection` → `HowItWorksSection` → `SupportSection` → `FaqSection` → `CtaSection` → `SiteFooter`.

## 2. Current reusable component inventory
- `components/landing/`: `SiteHeader`, `SiteFooter`, `Hero`, `OpportunitySection`, `HowItWorksSection`, `SupportSection`, `FaqSection`, `CtaSection`.
- `components/ui/`: `CtaLink` (primary/secondary/ghost, md/lg), `Section` (`Container`, `Section`, `SectionHeading`), `Reveal` (IntersectionObserver scroll reveal).
- `components/layout/`: `InfoPageLayout` (+`InfoSection`) for Privacy/Terms/Disclosures.

## 3. Current color system
`globals.css` `@theme`: `brand-50/100/500/600/700` (emerald: `#ecfdf5`, `#d1fae5`, `#10b981`, `#059669`, `#047857`) + `ink` (`#0f172a`). Otherwise default Tailwind neutral/white. Predominantly white + `brand-50`/`neutral-50` accents.

## 4. Current typography system
Default Tailwind sans stack; headings `font-bold`/`font-extrabold` + `tracking-tight`, scales via `text-2xl…text-5xl`. No custom font loaded.

## 5. Retain (functionally/structurally sound)
SiteHeader (sticky, mobile `<details>` menu) · SiteFooter (legal nav + disclosure) · CtaLink variant system · Reveal (with reduced-motion) · FAQ `<details>` accordion · section copy that is compliance-safe · `InfoPageLayout` (legal pages) · the full lead/attribution/CRM/meeting/security/legal stack (untouched).

## 6. Require visual redesign
All six homepage sections need visual treatment (Hero, Opportunity, HowItWorks, Support, FAQ, CTA) + footer polish. The current layout is functional but monotonously white/light.

## 7. Proposed section-by-section structure
1. **Header** — keep sticky translucent; minor polish (subtle bottom border/backdrop).
2. **Hero** — warm off-white/cream background with a botanical photograph composition (leaves/herbs/wellness), strong headline + subhead + primary/secondary CTA; organic rounded image mask.
3. **Trust strip** (new, thin) — three short credibility points (whole-food nutrition, decades of history, people-first) on cream/neutral.
4. **Opportunity** — pale botanical-green background; three image+card tiles.
5. **How It Works** — warm off-white; four steps with botanical number markers and organic shapes.
6. **Products/Wellness** (new/expanded) — photographic section on **deep forest-green** with cream text (nutrition/science visual language, compliance-safe).
7. **Support/Team** — image + card composition; pale green or cream.
8. **FAQ** — neutral/cream; keep native `<details>` accordion, polish styling.
9. **Final CTA** — distinct **deep forest-green** contrast band with strong CTA (visually distinct from the Products section to avoid repetition).
10. **Footer** — dark forest/ink footer with botanical accent; keep legal/disclosure links.

## 8. Proposed visual/background system
Rotate backgrounds down the page to avoid "white → white → white": cream/off-white → pale botanical green → deep forest green → photographic → cream → deep forest CTA → dark footer. Add subtle inline botanical SVG pattern/texture behind selected sections. Introduce organic rounded corners/blobs (not sharp cards everywhere).

## 10. Proposed interactive elements
Card hover lift (subtle) · CTA hover states · FAQ accordion (existing) · optional botanical float on hero · restrained, purposeful only.

## 11. Proposed animation/micro-interaction strategy
Keep the existing scroll-reveal (`Reveal`). Add hover micro-interactions and a gentle botanical float (CSS only, no library). Honor `prefers-reduced-motion: reduce` everywhere. No heavy animation.

## 12. Mobile/responsive strategy
Single-column stack with established breakpoints; responsive hero/product imagery (Next `Image` responsive sizes); keep the existing mobile `<details>` nav; ensure cards stack cleanly and deep-green sections keep readable padding.

## 13. Accessibility considerations
Maintain semantic landmarks, `#main-content` skip target, single `h1`, heading order, visible `:focus-visible`, descriptive `alt` text on images, `aria-hidden` decorative SVG, and ≥4.5:1 contrast (esp. cream-on-forest and green-on-green). No animation that violates reduced-motion.

## 14. Performance/image optimization considerations
Use Next `Image` (lazy, `sizes`, correct aspect ratio) for photos; inline SVGs for botanical textures; avoid layout shift (reserved image dimensions); no extra font/font-weights unless necessary. Keep CSP `img-src 'self' data: blob:` — self-host all imagery (do **not** add an external image CDN without a CSP/security review).

## 15. Files expected to change
- `src/app/globals.css` — expanded palette (`forest`, `cream`, accent greens) + botanical pattern/SVG utilities + animation tweaks.
- `src/components/landing/*.tsx` — `Hero`, `OpportunitySection`, `HowItWorksSection`, `SupportSection`, `FaqSection`, `CtaSection`, `SiteFooter` (and minor `SiteHeader` polish); add `ProductsSection` (or similar) + a small `Botanical`/`TrustStrip` component.
- `src/components/ui/Section.tsx` — optional `Section` background/tone variants.
- `src/app/page.tsx` — updated section composition.
- `public/` — any supplied photographs (commit only approved/placeholder assets).
- No changes to: `LeadForm`, `actions`, `attribution`, `auth`, `prisma`, admin CRM, meeting pipeline, `next.config.mjs` (unless imagery needs a CSP note), `InfoPageLayout`/legal pages.

## 16. Implementation scope and dependencies
- Scope: public landing only (visual/UX). Funnel, tracking, data, auth, CRM, security, legal wording, and infra are **out of scope and must remain unchanged**.
- Dependencies: Owner-approved brand assets (photography/logo) or placeholder approval; no new third-party design/libraries.
- This is a large visual task — recommend splitting into: (a) design tokens + section background system, (b) section-by-section rebuild, (c) image/asset integration, (d) polish + review.

## 17. Risks/regressions to watch
- **Funnel regressions** — do not touch lead form/actions/attribution; keep CTAs pointing to `/register-interest` and `#how-it-works`.
- **CSP** — only self-hosted imagery; inline styles fine; no external CDN.
- **Accessibility contrast** — deep forest + green text can fail contrast; verify.
- **Performance/LCP** — large hero images; use Next `Image`.
- **Layout shift** — reserve image dimensions.
- **Copy drift** — keep compliance-safe wording; no new medical/income claims.

## 18. Testing plan
`pnpm lint`/`typecheck`/`build` · `pnpm test` (43/43) · Playwright E2E (lead journey) · visual check at desktop + mobile widths · contrast/keyboard/semantics check · confirm `/register-interest`, `/admin/*`, attribution, and legal pages are unchanged · confirm no new external requests.

## 19. Acceptance criteria
- Clear visual variety down the scroll (no "all white" monotony).
- Botanical/wellness identity consistent with NeoLife positioning (nutrition + wellness + science), **without** any medical/treatment/cure implication.
- Strong hero, clear CTA hierarchy, scannable sections, purposeful motion.
- Fully responsive + accessible + performant.
- Lead capture, attribution, CRM, auth, meetings, security headers, and legal baseline all still green and untouched.
- Owner visual sign-off.

---

## 🟨 Owner decisions required before implementation
- **Imagery/brand assets** — A) Owner supplies final photography/logo · B) use approved placeholder imagery/SVG. **Kilo: B first, A when ready.**
- **Typography** — A) keep system sans (no new dependency) · B) add a display serif for botanical/editorial feel. **Kilo: A for now** (performance/simplicity), revisit later.

## Status
⚪ NOT STARTED. Recorded in `STATUS.md` as an Owner-approved planned upgrade. No code or production change has been made.


# NEOLIFE — Decision Log

Owner-approved decisions and their rationale. Every future implementation task must respect these.

## Recorded Decisions

### D-001 — Plan acceptance & Phase 1 authorization (2026-09-08)

- **Decision:** Owner accepted the Master Project Plan and MVP-first strategy, with targeted clarifications, and authorized **PHASE 1 — Traffic MVP** to begin. **PHASE 0 IS COMPLETE.**
- **Consequences:** Implementation proceeds local-first only; no production deployment; no paid advertising until §11.4 completion criteria and the §11.6 launch gate are satisfied; deferred features remain out of scope.

### D-002 — Approved technology stack (2026-09-08)

- **Decision:** Next.js 16 (App Router) + React 19 + TypeScript (strict) + PostgreSQL 16 + Prisma 7 (`@prisma/adapter-pg`) + Better Auth + Zod + Tailwind CSS 4 + pnpm; Vitest (unit) + Playwright (E2E); ESLint + Prettier.
- **Rationale:** Matches the established GHub/ZongFitness ecosystem conventions; proven, production-capable, and supports the full-platform blueprint without rework.
- **Basis:** Owner accepted the overall plan, which recommended this stack (§19 item 1). Recorded here as the approved technology decision required before scaffolding.

### D-003 — CRM lifecycle is an Owner-approved INITIAL model (2026-09-08)

- **Decision:** The status set in §19 item 4 is the initial, approved lifecycle. It is not a hard-coded business rule set; the implementation must keep statuses data-driven/extensible and must not encode business assumptions beyond the approved MVP requirement.

### D-004 — Registration ≠ authoritative distributor registration (2026-09-08)

- **Decision:** MVP "registration/business-interest tracking" records business interest and office-pipeline entry. The platform is NOT the authoritative NeoLife distributor-registration system.

### D-005 — MVP analytics = first-party funnel events + attribution (2026-09-08)

- **Decision:** MVP analytics are built on first-party funnel events and attribution data. No custom analytics platform is built in Phase 1.

### D-006 — Data-protection baseline (2026-09-08)

- **Decision:** MVP must include: data-retention policy, lead correction/deletion mechanism, consent record + timestamp, privacy context documentation, PII minimization, and access control on lead data.

### D-007 — Paid-traffic launch gate (2026-09-08)

- **Decision:** Advertising must not go live until ad creative/claims, disclosures, landing-page content, consent/privacy implementation, and relevant compliance requirements are reviewed and accepted (§11.6).

### D-008 — "Production-ready" definition (2026-09-08)

- **Decision:** "Production-ready" means MVP launch readiness (§11.4), not full-platform/enterprise completeness.

### D-009 — Expansion principle (2026-09-08)

- **Decision:** Design for expansion; do not build future features speculatively (§3 principle 11).

### D-010 — Early MVP deployment milestone (2026-09-08)

- **Decision:** Once the public landing page passes its local development and quality checks, the project may proceed to production deployment of the first slice (landing page/MVP) without completing the full platform. Deployment follows the §11.7 workflow and requirements (local-first, production isolation, no committed production secrets, approved deployment architecture, DNS/HTTPS verification, secure production env vars, production database/configuration, production smoke test, Owner production review/acceptance).
- **Consequences:** Paid advertising still requires all applicable production, compliance (§11.6 gate), tracking, and Owner launch gates. The early deployment does NOT mean the full platform is complete. **Deployment status: ⚪ NOT STARTED.**

### D-011 — Admin provisioning & authorization boundary (2026-09-08)

- **Decision:** Initial admin/office account is provisioned via `scripts/seed-admin.ts` reading `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars (never committed). Passwords are hashed by Better Auth. Authorization uses a single `role` field (`admin` can access CRM; `staff` default). There is **no public sign-up route**, so only seeded accounts exist.
- **Consequences:** Safe MVP boundary without an RBAC system. Additional accounts are added by re-running the seed or direct DB access. Flagged for Owner awareness — adjust if a richer role model is required later.

### D-012 — Advertising platform: Meta only for MVP (2026-09-08)

- **Decision:** MVP paid advertising runs on Meta (Facebook + Instagram) only. Google Ads is a later option, not MVP.

### D-013 — Tracking: first-party only for MVP (2026-09-08)

- **Decision:** First-party tracking only — UTM parameters, first-touch attribution, landing-page attribution, and lead/CRM attribution (already implemented). **No Meta Pixel, no GA4, no third-party advertising/analytics trackers for MVP.**

### D-014 — Domain/hosting: `neolife.ooflowdesk.com` via Owner infrastructure + Cloudflare Tunnel (2026-09-08)

- **Decision:** Deploy to `neolife.ooflowdesk.com` on the Owner's existing infrastructure via Cloudflare Tunnel. NEOLIFE must remain isolated from ZongFitness. **No production deployment yet.**

### D-015 — Legal copy: Kilo drafts; Owner marks MVP baseline COMPLETE (2026-09-08)

- **Decision:** Kilo drafted neutral, conservative Privacy Notice, Terms of Use, Disclosures, and related disclosure/consent wording. The Owner has decided these documents are **COMPLETE as the current MVP legal/compliance baseline**. They remain subject to future revision after further Owner/legal review. They are not legal advice and are not a claim of legal certification.

### D-017 — E2E via system Chrome (2026-09-08)

- **Decision:** Run the Playwright suite using the system-installed Google Chrome (`channel: "chrome"`) because the bundled Chromium download is network-blocked. Result: **1/1 PASS**.

### D-016 — Security headers + `/health` (2026-09-08)

- **Decision:** Implement application-level security headers and a minimal public `/health` endpoint now (for production/tunnel/monitoring), and test both.

### D-018 — Public website visual/conversion upgrade (Owner-approved direction) (2026-09-10)

- **Decision:** Add a planned public homepage visual redesign — Semrush-inspired UX quality with a NeoLife botanical/wellness visual identity (leaves/herbs/nutrition/nature), varied section backgrounds (not all-white), and a dynamic scroll. Compliance-safe (natural wellness + nutrition + science; no medical/cure claims). Public UI/UX only — no funnel/data/auth/CRM/infra changes.
- **Consequences:** Recorded as a planned upgrade (⚪ NOT STARTED) in `docs/DESIGN_UPGRADE_PLAN.md`. Implementation is NOT authorized yet; the plan is for Owner review.

## Open / Pending Decisions

- Hosting / domain target (before production deployment only).
- Advertising platforms & tracking for MVP (before paid-traffic launch).
- Legal/compliance content — owner/legal must supply or approve final wording (placeholders allowed during development).
- Meeting scheduling model confirmation (office/admin-driven recommended for MVP).

## Launch-Gate Record

- §11.6 Paid-traffic launch gate: **NOT PASSED** (not yet applicable — no advertising live).
## Pending Owner Decisions (recorded 2026-09-13, APPROVED 2026-09-13)

The following decisions were identified during the NeoLife Product Catalogue planning stage (`docs/PRODUCT_CATALOGUE_PLAN.md`). The Owner has approved proceeding with the following choices:

### D-019 — Initial price display (APPROVED)

- **Decision:** C) "Contact us" / "Request a quote" — no unapproved pricing displayed.
- **Rationale:** KSh price list is not yet available; the Owner will supply the authoritative Kenyan catalogue later.
- **Implementation:** `src/lib/catalogue-meta.ts` exports `PRICE_LABEL = "Contact us"`. Displayed on product cards and detail page.

### D-020 — Product imagery licensing (APPROVED)

- **Decision:** B) Placeholder imagery until licensed imagery is approved.
- **Rationale:** No official NeoLife imagery is embedded; placeholders use the existing botanical visual language until the Owner supplies licensed imagery.
- **Implementation:** `Photo` component with `tone="botanical"` used throughout catalogue pages and cards.

### D-021 — Email provider (APPROVED — NOT YET SELECTED)

- **Decision:** KEEP PROVIDER-AGNOSTIC. Do not lock to Resend or another provider.
- **Rationale:** Architecture is provider-agnostic via `src/lib/email.ts`; the provider can be swapped via `EMAIL_PROVIDER` env var without code changes.
- **Note:** The default mode is `none`/`dummy` (logs to console). Set `EMAIL_PROVIDER` and provider credentials when deployment requires notifications.
- **Implementation:** `src/lib/email.ts` — `sendMail()`, `buildInterestEmail()`, `isEmailConfigured()`.

### D-022 — Product description content (APPROVED)

- **Decision:** B) Concise original summaries based on official product information.
- **Rationale:** Descriptions are original, concise summaries — NOT copied verbatim from official marketing copy.
- **Implementation:** All 65 product descriptions in `src/lib/catalogue-data.ts` are original summaries.

### D-023 — Catalogue search/filter (APPROVED)

- **Decision:** A) Lightweight implementation.
- **Rationale:** No external search engine or new infrastructure. In-memory filtering across name, SKU, and description.
- **Implementation:** `searchCatalogue()` in `catalogue-data.ts`; `CatalogueSearch` component in `search-box.tsx`; `SubcategoryFilter` client component for subcategory filtering.

### D-024 — Subcategory route structure (APPROVED)

- **Decision:** A) Dedicated routes `/products/[category]/[subcategory]`.
- **Rationale:** SEO-friendly, shareable URLs; server-rendered pages with static generation where possible.
- **Implementation:** Routes at `src/app/products/[category]/`, `src/app/products/[category]/[subcategory]/`, and `src/app/products/[category]/[subcategory]/[product]/`.

### D-025 — Kenyan product list (APPROVED — NOT YET FINAL)

- **Decision:** B) Owner supplies authoritative Kenyan list — but use Northern Europe list as **temporary development/seed data only**.
- **Rationale:** The current 65 products are development/seed data sourced from the official NeoLife shop (Northern Europe). They are NOT the final authoritative Kenyan catalogue. The Owner will supply the Kenyan product list and KSh pricing later.
- **Implementation:** `src/lib/catalogue-data.ts` contains 65 products, 4 categories, 22 subcategories. This is marked as temporary in the file header and documentation.

### D-026 — ProductInterest data model (APPROVED)

- **Decision:** A) Separate `ProductInterest` entity.
- **Rationale:** Clean separation from Lead lifecycle; supports eventual business flow without coupling to order/e-commerce functionality.
- **Implementation:** `ProductInterest` model in `prisma/schema.prisma` (fields: productId, leadId, status, message, notificationSent, notificationSentAt). Architecture ready; full capture flow is a subsequent step.

## Resolved Decisions (was "Pending", now "Approved")

All of D-019 through D-026 were **pending** during planning and are now **APPROVED** as of 2026-09-13. The decisions listed above reflect the Owner's explicit approval.

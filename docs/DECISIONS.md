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

### D-029 — First-party funnel event tracking (2026-09-18)

- **Decision:** Implement a `FunnelEvent` table for first-party funnel/traffic measurement, separate from `LeadEvent` (which serves as the CRM audit trail). FunnelEvent stores only `type`, `leadId` (UUID FK), `attribution` (JSONB), `deviceId` (random client UUID), `metadata` (JSONB), and `createdAt`. FunnelEvent.leadId has a foreign key to `Lead(id)` with `ON DELETE SET NULL` so that lead deletions do not destroy funnel measurements.
- **Rationale:** First-party funnel events power the §6 Core Funnel journey tracking (landing → capture → qualification → registration → office pipeline → follow-up) without a custom analytics platform. Separating FunnelEvent from LeadEvent keeps marketing/analytics queries decoupled from CRM audit-trail semantics and avoids polluting LeadEvent with anonymous visitor events (events where leadId is null).
- **Consequences:** `src/lib/funnel.ts` records server-side events (`lead_created`, `lead_qualified`, `registration_complete`); `src/app/api/funnel/route.ts` accepts `visitor_landing` and `registration_start` from clients (proxy pattern); client-side `visitor_landing` events are sent via `FunnelTracker` and `registration_start` via `RegistrationForm` through the API route with rate limiting (5 req/min/IP) and first-party UTM attribution.

### D-030 — Qualification continuation token (2026-09-18)

- **Decision:** Implement a cryptographically signed, DB-backed single-use continuation token that binds a public qualification form to exactly one Lead. Token format: `<leadId>.<expiresAt>.<nonce>.<signature>` (HMAC-SHA256 using BETTER_AUTH_SECRET). Single-use is enforced durably via an atomic DB `updateMany` (set `consumedAt = NOW()` only where `consumedAt IS NULL AND expiresAt > NOW()`). Client components use a pure structural/expiration check for UX; the server action (`qualifyLeadAction`) re-validates the signature + DB nonce and consumes the token atomically. No Lead PII is embedded in the token.
- **Consequences:** `src/lib/qualification.ts` is split so that `parseToken` and `isTokenStructurallyValid` are client-safe (no Prisma, no `node:crypto`), while `generateQualificationToken`, `consumeQualificationToken`, and `validateQualificationToken` use dynamic `import()` for Prisma and `node:crypto` so they are server-only. DB integration tests are skipped when no PostgreSQL is available.

### D-031 — FunnelEvent data minimization: no IP/user-agent storage (2026-09-18)

- **Decision:** The `FunnelEvent` table MUST NOT store `ipAddress`, `userAgent`, `firstName`, `phone`, or `userId`. Device identification uses a client-generated `deviceId` (random UUID) only. This decision is enforced at the schema level (no such columns exist) and at the application layer (`src/lib/funnel.ts` and `src/app/api/funnel/route.ts` never accept or record these fields).
- **Rationale:** D-006 data-protection baseline requires PII minimization. IP addresses and user-agent strings are classified as personal data under Kenya's Data Protection Act. First-party funnel tracking for the MVP must not collect or persist this data — only deviceId (anonymous, client-generated) and validated first-party attribution are stored.

### D-032 — Registration/business-interest flow: no Meeting creation during public registration (2026-09-18)

- **Decision:** The public registration/business-interest step (Phase P-1 Task 1) captures `meetingPreference` (video_call / in_person / phone_call) as registration metadata for CRM follow-up. It does NOT create a `Meeting` record. Actual `Meeting` creation/scheduling remains an authenticated CRM operation performed by the Owner/Staff through the existing `scheduleMeeting` Server Action.
- **Rationale:** The public registration form is a business-interest capture step, not a booking system. Meetings require an authenticated CRM user (Owner/Staff), a definite `scheduledAt`, and audit-trail recording (`LeadEvent`). Creating a placeholder `Meeting` with a fake `scheduledAt` or `SCHEDULED` status would pollute the office pipeline. The captured `meetingPreference` is stored in the `registration_complete` FunnelEvent metadata and is available for CRM staff to use when scheduling.
- **Consequences:**
  - `src/app/actions/register-interest.ts` does NOT call `prisma.meeting.create`.
  - `meetingPreference` is persisted as metadata on `registration_complete` FunnelEvent only.
  - `registration_start` is emitted client-side when the form mounts (first-party, anonymous deviceId); `registration_complete` is server-side only after successful `ProductInterest` persistence.
  - The existing CRM Meeting workflow (`src/app/admin/(protected)/actions.ts` `scheduleMeeting`) is unchanged.

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

### D-020 — Product imagery licensing (APPROVED — UPDATED)

- **Decision:** B→A) Placeholder imagery was used initially (botanical `Photo` placeholders). Owner explicitly approved
  replacing all 65 product placeholders with official NEOLIFE product images sourced from neolifeshop.com.
- **Rationale:** Official imagery is now embedded from self-hosted WebP assets under `public/products/<slug>/product.webp`,
  sourced from the official NeoLife shop (Northern Europe market). All 65 product images were downloaded, converted to
  WebP, and verified loading (HTTP 200, `image/webp`). No placeholders remain for any product.
  - **Implementation:** `Photo` component now receives `src={product.image}` for every product on both `ProductCard` and
   the product detail page. The `image: string` field was added to `CatalogueProduct` and populated for all 65 products.
   - **Category images (2026-09-16 REBUILD):** The four "Browse by Category" cards now show compositions of *actual*
     catalogue product photographs — no generic/AI imagery. `public/categories/{nutritionals,weight-management,
     personal-care,home-care}.webp` (1200×800, composed from 4–5 real product images each). Removed
     `organic-skin-care.webp` (was incorrectly mapped to Weight Management). Source-product mapping documented in
     `docs/CATEGORY_IMAGE_SOURCES.md`. Rebuild script: `scripts/compose-category-images.cjs` (requires `sharp` devDependency).
- **Build:** `next.config.mjs` keeps `images: { unoptimized: true }` — pre-optimized WebP served directly.
- **Note:** D-025 still applies — the 65 products remain temporary development/seed data; the authoritative Kenyan
  catalogue will be supplied by the Owner.

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

### D-027 — Owner-controlled lead assignment model (APPROVED — 2026-09-17)

- **Decision:** OPTION A — Owner-controlled lead assignment.
  - The **Owner** (role `admin`) can view all leads, assign leads to Staff, reassign leads between Staff, and leave leads unassigned (null = Owner's pool).
  - **Staff** (role `staff`) can view and work only on leads explicitly assigned to them. Staff cannot assign, reassign, or unassign leads. Staff cannot change `assignedUserId` through crafted requests/API calls.
  - The Owner remains solely responsible for lead allocation.
- **Rationale:** Owner approved Option A on 2026-09-17 for the two-user CRM expansion. This is the minimal viable assignment model — no per-lead workflows, no self-service assignment, no cross-tenant complexity (single-tenant office CRM).
- **Enforcement:**
  - Server-side: `assignLead` Server Action calls `requireAdmin()` — only the Owner can invoke it; non-Admin requests are rejected before any data mutation.
  - Target-user validation: the target user must exist and have `role = "staff"`; Admin users and arbitrary IDs are rejected.
  - Ownership scoping: Staff lead-list and lead-detail queries filter on `assignedUserId` (Phase A). Staff accessing an unassigned or other-user's lead receives 404.
  - Audit trail: `lead_assigned` and `lead_unassigned` events are recorded in `LeadEvent` with `metadata.by`, `from`, and `to`.
- **Implementation:** `src/lib/assignment.ts` (pure authorization helpers), `src/app/admin/(protected)/actions.ts` (`assignLead`, `getCrmUsers`), `src/components/admin/AssignmentForm.tsx`, `src/app/admin/(protected)/leads/[id]/page.tsx` (Owner-only UI).
- **Schema change:** `Lead.assignedUserId` (nullable String/TEXT, FK to `User.id`, `ON DELETE SET NULL`) + indexes — Phase A migration `20260917000000_add_lead_ownership`.
- **No new Owner decision required.**

### D-028 — Canonical audit actor on LeadEvent (APPROVED — 2026-09-17)

- **Decision:**
  - Keep `LeadEvent.type` as a `String` (not a PostgreSQL enum). Documentation updated to match.
  - Add nullable `LeadEvent.userId TEXT` as the **canonical** audit actor field (FK to `User.id`, `ON DELETE SET NULL`, indexed).
  - `LeadEvent.userId` is populated from the authenticated server-side CRM user — never from client-supplied actor IDs.
  - Existing audit records are preserved (null userId for legacy/backfilled events).
  - If existing `metadata.by` is retained, it must remain consistent with `userId`.
- **Enforcement:**
  - All Server Actions (`updateLeadStatus`, `addFollowUp`, `scheduleMeeting`, `updateMeeting`, `assignLead`) set `userId` from the server-side session.
  - Staff cannot forge `LeadEvent.userId` — server always uses the authenticated user's ID.
- **Implementation:** `prisma/schema.prisma` (`LeadEvent.userId`), migration `20260917120000_add_leadevent_actor/migration.sql`, `src/app/admin/(protected)/actions.ts`.
- **No new Owner decision required.**

## Resolved Decisions (was "Pending", now "Approved")

All of D-019 through D-026 were **pending** during planning and are now **APPROVED** as of 2026-09-13. The decisions listed above reflect the Owner's explicit approval.

### D-033 — Admin user management for Phase P-2 (APPROVED — 2026-09-19)

- **Decision:** Add `mustChangePassword` and `isActive` boolean fields to the `User` model. Owner (admin) can create Staff users with a temporary password that is enforced to change on first login. Owner can deactivate/reactivate Staff users. Inactive users cannot authenticate or access CRM routes.
- **Rationale:** Two-user CRM requires the Owner to provision Staff accounts and be able to revoke access. Forced password change on first login ensures the Owner-chosen temp password is not retained.
- **Enforcement:**
  - `createCrmUser` Server Action calls `await requireAdmin()` before any user creation; Staff users cannot invoke it.
  - The `role` field has `input: false` in Better Auth config — clients cannot self-assign roles. New Staff accounts are hardcoded `role: "staff"` via Prisma after sign-up.
  - `toggleUserActive` Server Action calls `await requireAdmin()`; additionally prevents deactivating admin accounts and prevents self-deactivation at the server level.
  - `getCrmUser()` returns `null` for inactive users — they cannot access any protected CRM route.
  - The protected layout redirects users with `mustChangePassword: true` to `/admin/change-password`; that page is outside the `(protected)` route group to avoid redirect loops.
  - `mustChangePassword` is cleared only after successful password change via Better Auth's `changePassword` API.
- **Password security:**
  - Passwords are hashed by Better Auth's `signUpEmail`/`changePassword` APIs — never stored in plaintext by the application.
  - Temp passwords are not logged or returned in API responses.
- **Implementation:** `prisma/schema.prisma`, `prisma/migrations/20260919000000_add_user_management_fields/`, `src/lib/auth.ts`, `src/lib/user-management.ts`, `src/server/auth/requireCrmUser.ts`, `src/app/admin/(protected)/actions.ts` (`createCrmUser`, `toggleUserActive`, `changePasswordAction`), `src/app/admin/(protected)/users/page.tsx`, `src/app/admin/(protected)/users/create-user-form.tsx`, `src/app/admin/change-password/page.tsx`, `src/app/admin/change-password/change-password-form.tsx`.

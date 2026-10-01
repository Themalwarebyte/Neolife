# NEOLIFE — Changelog

## Unreleased

### Admin user management (🟩 local)

Implemented Owner-approved admin user management for Phase P-2 preparation: Staff user creation with forced password change on first login, activation/deactivation toggle, and password-change flow.

**Schema:**
- `prisma/schema.prisma` — added `mustChangePassword Boolean @default(false)` and `isActive Boolean @default(true)` to the `User` model.
- `prisma/migrations/20260919000000_add_user_management_fields/migration.sql` — new migration.
- `src/lib/auth.ts` — registered both fields as Better Auth `additionalFields` (`mustChangePassword` with `input: true`, `isActive` with `input: true`).

**Server actions (`src/app/admin/(protected)/actions.ts`):**
- `createCrmUser` — Owner-only; creates a Staff user via Better Auth `signUpEmail`, then sets `role: "staff"` and `mustChangePassword: true` via Prisma. Rejects duplicate emails.
- `toggleUserActive` — Owner-only; toggles `isActive` on a user. Owner accounts cannot be deactivated.
- `changePasswordAction` — any authenticated user with `mustChangePassword`; calls Better Auth `changePassword`, then clears `mustChangePassword`.

**Pages:**
- `src/app/admin/(protected)/users/page.tsx` — Admin Users page (server-rendered table + client create-user form).
- `src/app/admin/(protected)/users/create-user-form.tsx` — client form with `useActionState` for error/success feedback.
- `src/app/admin/change-password/page.tsx` — change-password page (outside `(protected)` to avoid redirect loop).
- `src/app/admin/change-password/change-password-form.tsx` — client form with `useActionState`, current/new/confirm password fields.

**Auth guard:**
- `src/server/auth/requireCrmUser.ts` — `getCrmUser`/`requireCrmUser` now return `mustChangePassword`; inactive users are treated as unauthenticated (return null).
- `src/app/admin/(protected)/layout.tsx` — redirects users with `mustChangePassword: true` to `/admin/change-password`; added "Users" nav link for Owner accounts.

**Tests:**
- `tests/user-management.test.ts` — 13 pure schema validation tests.
- `tests/user-management-db.test.ts` — 4 DB integration tests (skipped without local PostgreSQL).

**Verification:**
- Lint: PASS (0 errors, 0 warnings)
- Typecheck: PASS (`tsc --noEmit`)
- Tests: 167 passed, 55 skipped (DB-only) · E2E 10/10 PASS

### Phase P-1 — Registration / business-interest flow (🟩 local)

Implemented the Owner-approved registration/business-interest capture flow (D-026 full capture step; D-032 meeting-model decision).

**New files:**
- `src/lib/registration.ts` — pure validation for registration input (productId UUID, meetingPreference enum, additionalContext optional ≤1000 chars). Client-safe (no Prisma import).
- `src/lib/funnel-device.ts` — shared first-party device-ID utility (`getOrCreateDeviceId`); consolidates previously duplicated logic from `FunnelTracker.tsx` and `LeadForm.tsx`.
- `src/app/actions/register-interest.ts` — Server Action handling optional post-capture registration: validates qualification token (non-consuming via `validateQualificationToken`), validates input, verifies product existence, persists `ProductInterest` + `registration_complete` FunnelEvent in a transaction.
- `src/components/leads/RegistrationForm.tsx` — client component with product dropdown, meeting-preference radios, context textarea. Emits `registration_start` client-side on mount (via `recordFunnelEventClient`).
- `tests/registration-validation.test.ts` — 16 pure validation tests.
- `tests/registration-persistence.test.ts` — 5 DB integration tests + 2 pure tests.

**Modified files:**
- `src/lib/funnel.ts` — added `registration_start` and `registration_complete` to `VALID_FUNNEL_EVENT_TYPES` and `FunnelEventType`.
- `src/lib/funnel-client.ts` — extended `ClientFunnelEventInput` type to allow `registration_start` from clients (was `visitor_landing` only).
- `src/app/api/funnel/route.ts` — API route now accepts `registration_start` (in addition to `visitor_landing`) from clients; `registration_complete` remains server-side only.
- `src/components/tracking/FunnelTracker.tsx` — refactored to use shared `getOrCreateDeviceId` from `funnel-device.ts`.
- `src/components/leads/LeadForm.tsx` — refactored to use shared `getOrCreateDeviceId`.
- `src/app/register-interest/qualify/page.tsx` — added RegistrationForm section with featured products fetched from DB.
- `tests/funnel-events.test.ts` — updated valid event-type set to include all five types; added DB tests for `registration_start`/`registration_complete` persistence.

**Funnel event semantics:**
- `registration_start` — emitted client-side when the RegistrationForm mounts (entry into the registration step). Anonymous (deviceId only, no leadId).
- `registration_complete` — emitted server-side only, after successful `ProductInterest` persistence within the DB transaction.
- The server action does NOT record `registration_start` — it is client-side only.

**Security:**
- Qualification token validated server-side via `validateQualificationToken` (HMAC-SHA256 + DB nonce + expiration check).
- Token NOT consumed by registration (non-consuming validation) — remains valid for the optional QualificationForm.
- Lead ID derived exclusively from the verified token — never from client form input.
- Product IDs verified against DB (`prisma.product.findUnique`).
- Registration remains rate-limited (5 req/min/IP via existing `rateLimit.ts`).
- No PII added to FunnelEvent (D-031 preserved).

**Meetings:** Registration does NOT create a Meeting (D-032 Owner decision). `meetingPreference` is captured as metadata on `registration_complete` for CRM follow-up. Meeting creation remains an authenticated CRM operation.

**Documentation:**
- `docs/DECISIONS.md` — added D-032: Registration/business-interest flow — no Meeting creation during public registration.
- `docs/CHANGELOG.md` — this entry.
- `docs/STATUS.md` — Phase P-1 section added.

**Verification:**
- Lint: PASS (all new/modified files)
- Typecheck: PASS (`tsc --noEmit`)
- Build: PASS (Next.js production build)
- Tests: 167 passed, 55 skipped (DB-only) (was 206/206; 16 new tests added) · E2E 10/10 PASS via system Chrome

### Phase B — Owner-controlled lead assignment (🟩 local)

Implemented the Owner-approved Option A two-user CRM assignment model.

**Schema & migration:**
- `Lead.assignedUserId` nullable UUID FK to `User.id` (`ON DELETE SET NULL`) + indexes (`@@index([assignedUserId])`, `@@index([assignedUserId, status])`) — Phase A migration `20260917000000_add_lead_ownership/migration.sql`.
- `User.assignedLeads` back-relation added.

**New files:**
- `src/lib/assignment.ts` — pure authorization helpers: `canAssignLeads`, `isAssignableRole`, `canViewLead`, `leadVisibilityWhere`, `OWNER_ROLE`, `STAFF_ROLE`.
- `src/server/auth/requireCrmUser.ts` — role-aware auth module (`getCrmUser`, `requireCrmUser`, `requireAdmin`, `isAdminSession`, `CrmUser`).
- `src/components/admin/AssignmentForm.tsx` — Owner-only dropdown (assign/reassign/unassign) with live result feedback.
- `scripts/seed-staff.ts` — development/test Staff account provisioning (env-var based, no hard-coded secrets).
- `prisma/migrations/20260917000000_add_lead_ownership/migration.sql`.
- `tests/assignment-authorization.test.ts` — 15 pure-logic authorization tests (no DB required).
- `tests/assignment-integration.test.ts` — 4 DB-integration tests (skipped without local PostgreSQL).

**Modified files:**
- `src/app/admin/(protected)/actions.ts` — `assignLead` (owner-only via `requireAdmin`, target-user validation, audit events); `getCrmUsers` helper; existing actions refactored from `isAdminAuthorized` → `requireCrmUser` + `verifyLeadOwnership`.
- `src/app/admin/(protected)/leads/page.tsx` — ownership-scoped `findMany` (Owner: all; Staff: assigned-only) + "Assigned" column.
- `src/app/admin/(protected)/leads/[id]/page.tsx` — ownership-scoped `findUnique`; Owner-only AssignmentForm in Manage section; assignee name displayed.
- `src/app/admin/(protected)/layout.tsx` — role-aware badge (Owner/Colleague).
- `src/app/admin/page.tsx` — `getCrmUser` redirect (any authenticated user → `/admin/leads`).
- `.env.example` — added `STAFF_EMAIL`/`STAFF_PASSWORD`/`STAFF_NAME`.

**Security:**
- Only the Owner can assign/reassign leads (server-side enforced via `requireAdmin`).
- Staff assignment attempts rejected (404 on detail, no action available).
- `assignedUserId` validated server-side; target must be `role = "staff"`.
- Audit events: `lead_assigned` and `lead_unassigned` recorded with `by`/`from`/`to` metadata.
- No credentials, passwords, or secrets committed.

**Documentation:**
- `docs/DECISIONS.md` — D-027: Owner-controlled lead assignment model recorded.
- `docs/STATUS.md` — Phase B status updated.
- `docs/CHANGELOG.md` — this entry.
- `docs/ARCHITECTURE.md` — auth/authorization flow documented.
- `docs/RECOVERY.md` — created (recovery procedures for auth/CRM schema).

### Phase C — Canonical audit actor on LeadEvent (🟩 local)

Completed the Owner-approved audit-actor tracking requirement.

**Schema & migration:**
- `LeadEvent.userId` nullable TEXT FK to `User.id` (`ON DELETE SET NULL`) + index (`@@index([userId])`) — migration `20260917120000_add_leadevent_actor/migration.sql`.
- `LeadEvent.type` kept as `String` (not migrated to PostgreSQL enum) per D-028.
- Existing audit records preserved (null userId for legacy events).

**Server Actions updated:**
- `updateLeadStatus` — `status_changed` event now sets `userId` from the authenticated CRM user.
- `addFollowUp` — `follow_up_added` event now sets `userId`.
- `scheduleMeeting` — `meeting_scheduled` event now sets `userId`.
- `updateMeeting` — `meeting_status_changed` event now sets `userId`.
- `assignLead` — `lead_assigned` and `lead_unassigned` events now set `userId` (the Owner/admin performing the assignment).

**Security:**
- `LeadEvent.userId` is always populated from the server-side authenticated session — never from client-supplied actor IDs.
- Existing `metadata.by` field retained and kept consistent with `userId`.
- Staff cannot forge `LeadEvent.userId` — all actions use `requireCrmUser()` and set the actor from the session.

**New tests:**
- `tests/assignment-reassignment.test.ts` — 13 tests (9 pure + 4 DB): verifies unassigned→Staff, Staff A→Staff B reassignment, Staff→unassigned, and null userId for legacy events.
- `tests/staff-status-authorization.test.ts` — 16 tests (10 pure + 6 DB): verifies Staff updates own lead with correct audit actor, Staff cannot update unassigned/another-Staff lead, forged `assignedUserId` ignored, forged actor ID rejected, Owner can update any lead.

**Modified tests:**
- `tests/assignment-integration.test.ts` — "Audit event recorded on manual assignment" test updated to set and verify `userId` alongside `metadata.by`.

**Documentation:**
- `docs/DECISIONS.md` — D-028: Canonical audit actor on LeadEvent recorded.
- `docs/STATUS.md` — Phase C status updated.
- `docs/ARCHITECTURE.md` — LeadEvent model updated with `userId` field.

### Official NEOLIFE product images (🟩 deployed)

Replaced all 65 product-image placeholders with official NEOLIFE product images from neolifeshop.com.

- All 65 product images downloaded from neolifeshop.com (Northern Europe market), converted to WebP, and stored as
  self-hosted assets under `public/products/<slug>/product.webp`.
- Added required `image: string` field to `CatalogueProduct` type in `src/lib/catalogue-data.ts`; populated for all 65 products.
- `ProductCard.tsx` and the product detail page now pass `src={product.image}` to the `Photo` component (real `<img>`
  rendered; `next.config.mjs` `images.unoptimized: true`).
- Added 2 tests verifying every product has a valid image path matching `/products/<slug>/product.webp` and that each
  file exists.
- Included `scripts/download-images.ps1` (download) and `scripts/convert-images.sh` (WebP conversion) build scripts.
- **Deployed to production** as commit `11e64fa` (tag `neolife-web:11e64fa`). All 65 images serve `image/webp` (HTTP 200).
  No placeholder imagery remains for any product.
- D-020 updated from "placeholder imagery" to "official NEOLIFE images".
- D-025 unchanged: 65 products remain temporary development/seed data.

### Rebuild category images from actual catalogue products (🟩 deployed)

Replaced all four "Browse by Category" images with compositions built from **actual NEOLIFE product photographs**
in the catalogue — no AI-generated imagery, no generic stock photos, no cross-category substitution.

- **Nutritionals** (5 products): Formula IV, Tre-en-en, Omega-3 Plus, CoQ10, Kal-Mag Plus D
- **Weight Management** (4 products): NeoLifeShake Rich Chocolate, NeoLifeShake Creamy Vanilla, NeoLifeBar, NeoLifeTea
- **Personal Care** (5 products): Mild Revitalizing Shampoo, Enriching Conditioner, Rejuvenating Rich Cream, Ultra Moisturizing Cream, Aloe Vera Gel
- **Home Care** (4 products): G1 Laundry Detergent, Super 10 5L, LDC Hand Soap 1L, Soft Fabric Softener

- Each image: 1200×800, 3:2 aspect ratio (matches `aspect-[3/2]` card), warm cream background, subtle drop shadows.
  No product packaging labels/logos/colors altered — products composed faithfully from official images.
- Source-product mapping documented in `docs/CATEGORY_IMAGE_SOURCES.md`.
- Rebuild script: `scripts/compose-category-images.cjs` (uses `sharp` devDependency; reproducible).
- Removed `public/categories/organic-skin-care.webp` (was incorrectly mapped to Weight Management as a fallback).
- Updated `CATEGORY_IMAGES` in `src/lib/catalogue-meta.ts`: `weight-management → /categories/weight-management.webp`.
- Updated `eslint.config.mjs` to ignore `scripts/**` (build utility scripts).
- **Deployed to production** as image `neolife-web:b371fcf` (commits b371fcf, ab62506, 7784de5).
- Audit notes: no misclassifications found; 6 products cross-listed between Nutritionals and Weight Management
  per `categorySlugs` (correctly assigned to Weight Management image; Nutritionals image uses pure nutritional products).
- **Production verification:** all 4 category images serve `image/webp` (HTTP 200); old `organic-skin-care.webp` returns 404; all 65 product images intact; `/health` → 200; `/products` → 200; DB/tunnel containers unaffected.

### Phase D — Funnel events + qualification tokens (🟩 local)

Implemented D-029 (first-party funnel event tracking), D-030 (qualification continuation tokens), and D-031 (no IP/user-agent in FunnelEvent).

**Schema & migration:**
- `FunnelEvent` model — first-party funnel/traffic measurement table, separate from `LeadEvent`. Columns: `id`, `type`, `leadId` (FK to Lead, `ON DELETE SET NULL`), `attribution` (JSONB), `deviceId` (random UUID), `metadata` (JSONB), `createdAt`. **No `ipAddress`, `userAgent`, `firstName`, `phone`, or `userId` columns** (D-031). Indexes on type, leadId, createdAt, deviceId, (deviceId, createdAt).
- `QualificationToken` model — DB-backed single-use token. Columns: `id`, `leadId` (FK to Lead, `ON DELETE CASCADE`), `nonce` (UNIQUE), `expiresAt`, `consumedAt`, `createdAt`. Indexes on leadId, expiresAt, consumedAt.
- Migration: `prisma/migrations/20260918000000_add_funnel_events/migration.sql`.

**New files:**
- `src/lib/qualification.ts` — server-side token functions: `generateQualificationToken`, `consumeQualificationToken` (atomic DB `updateMany` with `consumedAt IS NULL AND expiresAt > NOW()`), `validateQualificationToken`, `sign`, `getTokenSecret`. Uses dynamic `import()` for Prisma and `node:crypto`.
- `src/lib/qualification-client.ts` — client-safe token functions: `parseToken`, `verifyTokenSignature`, `isTokenStructurallyValid`, `parseQualificationInput`. No Prisma, no `node:crypto`.
- `src/lib/funnel.ts` — server-side `recordFunnelEvent`: validates event type, re-validates attribution, sanitizes metadata/deviceId.
- `src/lib/funnel-client.ts` — client-safe `recordFunnelEventClient`: delegates to `/api/funnel` API route via fetch, type-restricted to `visitor_landing`.
- `src/app/api/funnel/route.ts` — API Route Handler (POST) accepting only `visitor_landing` from clients.
- `src/app/actions/qualify.ts` — `qualifyLeadAction` Server Action.
- `src/app/register-interest/qualify/page.tsx` — qualification page.
- `src/components/leads/QualificationForm.tsx` — client form with structural token check.
- `src/components/tracking/FunnelTracker.tsx` — client-side `visitor_landing` tracker.
- `tests/funnel-events.test.ts` — 14 tests (5 pure + 9 DB skipped without PostgreSQL).
- `tests/qualification.test.ts` — 27 tests (16 pure + 11 DB skipped without PostgreSQL).
- `scripts/test-db-integration.js` — 30 DB integration tests.

**Modified files:**
- `src/app/actions/lead.ts` — generates qualification token on lead creation; records `lead_created` FunnelEvent.
- `src/app/layout.tsx` — adds `FunnelTracker` component for landing event tracking.
- `src/components/leads/LeadForm.tsx` — passes `deviceId` hidden field for funnel correlation.
- `prisma/schema.prisma` — added `FunnelEvent` and `QualificationToken` models.

**Security:**
- D-031: FunnelEvent stores NO PII (no IP, no user-agent, no firstName/phone/userId). Anonymous device correlation via client-generated UUID.
- D-030: Token binds to one Lead; leadId extracted from verified token (not client input); single-use enforced atomically; no Lead PII in token; HMAC-SHA256 signature.
- Client components use only structural token validation (UX); server always re-validates signature + DB nonce.
- Rate limiting (5 req/min/IP) on both lead capture and qualification.

**Verification:**
- Lint: PASS (all Phase D files)
- Typecheck: PASS
- Build: PASS (`/api/funnel`, `/register-interest/qualify` routes)
- Pure tests: 37/37 PASS (27 qualification + 14 funnel-events, 20 DB tests skip without PostgreSQL)
- DB integration: 30/30 PASS from WSL (schema, token lifecycle, replay prevention, qualification workflow)
Added `src/app/admin/page.tsx` — server-side redirect: authenticated admin → `/admin/leads`, otherwise → `/admin/login`. Added `e2e/admin-redirect.spec.ts` (unauthenticated redirect). No schema, auth, CRM, or infra changes.

### Fix — admin seed path-alias resolution (🟩 local)
The production admin `seed` failed with `ERR_MODULE_NOT_FOUND` because `tsx` could not resolve the `@/*` path alias (`src/lib/auth.ts` → `@/server/db/prisma` → `@/generated/prisma/client`) — the runtime Docker image did not include `tsconfig.json` (which defines `"@/*": ["./src/*"]`). Added `COPY --from=build /app/tsconfig.json ./` to the Dockerfile runtime stage. Verified end-to-end in a disposable container: `prisma migrate deploy` → `scripts/seed-admin.ts` → `Admin account ready (role=admin)` with a password credential account present.

### Visual Pass 3 — richer photographic rhythm (🟩 local)
Added immersive background photography to the previously plain sections, while keeping the existing real photography:
- **How It Works** — subtle full-bleed `how-it-works.webp` background with a cream→green translucent gradient overlay; step cards now have a soft shadow for depth.
- **FAQ** — subtle full-bleed `faq.webp` background with a cream overlay (`/85`); accordion cards remain solid white for readability.
- **Opportunity** — larger `opportunity.webp` treatment + botanical accent.
- **Products & Wellness** — larger `wellness.webp` + additional botanical accent.
- New assets: `public/images/landing/{how-it-works,faq}.webp` (Unsplash License; documented in the asset manifest).
- No changes to lead capture, attribution, CRM, auth, database, legal pages, CSP, or deployment config.

### Visual polish — Final CTA background + button contrast (🟩 local)
- Final CTA now renders `final-cta.webp` as a true full-bleed background via `next/image` `fill` with a dark forest-green gradient overlay (fixed a `relative`/`absolute` conflict in the `Photo` wrapper that prevented correct background positioning).
- Primary CTA buttons darkened from `bg-brand-600` (~3.2:1 white-text contrast) to `bg-brand-700` (~5.5:1, WCAG AA) with `hover:bg-forest-700`; final-CTA button no longer carries conflicting `bg-white`/`text-forest-900` overrides (was rendering white-on-white) and now uses the primary green + white text with a subtle `ring-white/30`.
- No changes to lead capture, attribution, CRM, auth, database, legal pages, CSP, or deployment config.

### Visual Pass 2 — Photography (real self-hosted imagery) — 🟩 DONE locally
Replaced every botanical photographic placeholder on the public landing page with real, self-hosted photography (Unsplash License). Added `src/components/ui/Photo.tsx` (reusable image-presentation system) and wired `src="/images/landing/*.webp"` into the Hero, Opportunity, Products/Wellness, Support, and Final-CTA sections. All five `Photo` slots now render real `<Image>`s.

- Added `images.unoptimized: true` to `next.config.mjs` (serve pre-optimized WebP directly; avoids a native `sharp`/alpine dependency; `next/image` still provides lazy-loading + layout stability). No CSP change required (`img-src 'self'`).
- Added explicit `COPY --from=build /app/public ./.next/standalone/public` to the Dockerfile (Next standalone output does not copy `public/` automatically).
- Asset manifest: `public/images/landing/README.md` (filename, source photo ID/URL, Unsplash License, usage, sizes).
- Funnel, attribution, auth, CRM, meetings, security headers, and legal baseline unchanged.

### Visual/conversion upgrade (Owner-approved direction D-018)
Implemented locally (public homepage only): botanical/wellness visual identity with varied section backgrounds (cream, pale green, deep forest), decorative botanical SVG motifs (`ui/Botanical.tsx`), new `TrustStrip` + `ProductsSection`, dark footer. Funnel, attribution, auth, CRM, meetings, security, and legal baseline are unchanged. Placeholder imagery (gradient + SVG) used; final photos swap-in ready.

- Added `Dockerfile` (multi-stage, standalone runtime + Prisma migration/seed support) and `.dockerignore`.
- Verified locally: image builds; `prisma migrate deploy` applies all migrations against a disposable PostgreSQL; image serves `/health`.
- Added `deploy/compose.yaml` — canonical production Compose (secret-free `${VAR}` placeholders): `web`, `db`, `tunnel`, and a **profiled `seed` service** so `ADMIN_EMAIL`/`ADMIN_PASSWORD` are injected from the secret file (never typed on a CLI). Dedicated `neolife` project/network/volume; no host ports; no shared resources.
- Authored `docs/DEPLOYMENT_EXECUTION_PLAN.md` (isolated additive deployment; root-owned secret file + `sudo docker compose --env-file` injection; corrected DB/migration/backup sequence).
- Redesigned production secret handling (root-owned `/opt/ooflowdesk/secrets/neolife.env`, `${VAR}` interpolation only).

### Release commit
The production image is tied to commit `3f535c5e565d6f3dd35848b4eb3595f9ee482ef7` (the Dockerfile commit). The deploy Compose file (`deploy/compose.yaml`) is added in a subsequent commit; it references `neolife-web:3f535c5`.

### Secret architecture (Owner decision A — accepted)
Environment-variable injection, with the root-owned `/opt/ooflowdesk/secrets/neolife.env` (`root:root 0600`) as the source. Accurate security wording (documented): the secret source file is root-only; because the existing `ooadmin` account has root-equivalent Docker privileges, secrets injected into container environments are technically inspectable by that account; NEOLIFE does not modify this existing server privilege model; Kilo must not intentionally inspect, print, log, or expose secret values.


### Product catalogue — implementation (🟩 local, Owner-approved D-019–D-026)

The product catalogue planning document (`docs/PRODUCT_CATALOGUE_PLAN.md`) has been superseded by actual implementation. Owner decisions D-019–D-026 approved (2026-09-13).

**Committed (data layer — commit ce7cbcb):**
- `prisma/schema.prisma` — added `Category`, `Subcategory`, `Product`, `ProductCategory`, `ProductSubcategory`, `ProductInterest` models + `InterestStatus` enum. `Lead` model extended with `productInterests` relation.
- `prisma/migrations/20260913061907_add_product_catalogue/migration.sql` — migration for all catalogue tables, indexes, and foreign keys.
- `src/lib/catalogue-data.ts` — 65 products, 4 categories, 22 subcategories (Northern Europe catalogue as **temporary development/seed data only**).
- `scripts/seed-catalogue.ts` — idempotent seed/upsert script for categories, subcategories, and products.
- `src/lib/email.ts` — provider-agnostic email abstraction (Resend/SendGrid/Mailgun/SES/dummy); no provider locked, default `none`/`dummy` mode logs to console.

**Uncommitted (routes + UI + tests):**
- `src/app/products/` — 4 route pages: `page.tsx`, `[category]/page.tsx`, `[category]/[subcategory]/page.tsx`, `[category]/[subcategory]/[product]/page.tsx`. All with designed backgrounds (forest/cream gradients with botanical accents), breadcrumbs, SEO metadata, responsive grid, product cards, and CTA/interest pathway.
- `src/components/catalogue/` — `hero.tsx`, `category-grid.tsx`, `ProductCard.tsx`, `search-box.tsx`, `SubcategoryFilter.tsx`, `Breadcrumb.tsx`. All use the existing visual language (Leaf/Sprig botanicals, Reveal animations, Photo placeholders).
- `src/lib/catalogue-meta.ts` — catalogue helpers (slugs, breadcrumbs, SEO, `productUrl`, `primarySubcategoryForProduct`, `PRICE_LABEL`).
- `tests/catalogue-data.test.ts` — 28 tests for data integrity + routing.
- `src/components/landing/SiteHeader.tsx` — added "Products" nav link.

**Decisions (all approved):**
- D-019: "Contact us" pricing (no prices shown until Owner supplies KSh list)
- D-020: Official NEOLIFE product images from neolifeshop.com (65 images, downloaded & WebP-converted; deployed)
- D-021: Email provider REMAINS PROVIDER-AGNOSTIC (not yet selected)
- D-022: Concise original descriptions (not copied verbatim)
- D-023: Lightweight search/filter (in-memory, no external engine)
- D-024: Dedicated subcategory routes
- D-025: 65 products are TEMPORARY DEVELOPMENT/SEED DATA (not the final Kenyan catalogue)
- D-026: Separate `ProductInterest` entity

**Visual quality:**
- All public-facing pages now have designed backgrounds (cream/forest gradients with botanical SVG motifs, leaf/sprig decorative elements, Reveal scroll animations). Previously plain-white pages (register-interest, InfoPageLayout for legal pages) now match the site's visual identity.

**Fix:**
- Removed stray duplicate file `src/components/catalogue CatalogueSearch.tsx` (space in filename; valid replacement is `search-box.tsx`).
- Fixed ProductCard/search-box URL generation: routes now always include the `[subcategory]` segment, preventing 404s when products are accessed from category or search listings.
- Product detail page now validates that the product belongs to both the specified category and subcategory (notFound() on mismatch).

**Verification:**
- Lint: PASS (0 errors, 0 warnings)
- Typecheck: PASS (`tsc --noEmit`)
- Tests: 71/71 PASS (43 original + 28 catalogue)
- Build: PASS (9 static + 5 dynamic routes)

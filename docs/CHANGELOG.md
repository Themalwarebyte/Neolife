# NEOLIFE — Changelog

## Unreleased

### Add `/admin` entry point (🟩 local)
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
- D-020: Placeholder imagery (no official imagery embedded)
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

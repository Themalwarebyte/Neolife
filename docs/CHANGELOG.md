# NEOLIFE — Changelog

## Unreleased

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


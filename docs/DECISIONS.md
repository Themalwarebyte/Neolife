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

## Open / Pending Decisions

- Hosting / domain target (before production deployment only).
- Advertising platforms & tracking for MVP (before paid-traffic launch).
- Legal/compliance content — owner/legal must supply or approve final wording (placeholders allowed during development).
- Meeting scheduling model confirmation (office/admin-driven recommended for MVP).

## Launch-Gate Record

- §11.6 Paid-traffic launch gate: **NOT PASSED** (not yet applicable — no advertising live).
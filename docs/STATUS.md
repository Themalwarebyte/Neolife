# NEOLIFE — Project Status

Phase/step-by-step implementation status. Authoritative scope lives in `PROJECT_PLAN.md`.

## PHASE 1 — TRAFFIC MVP 🔵 IN PROGRESS

### Task 1.1 — Foundation / scaffolding — 🟩 DONE (2026-09-08)

**Implemented (local-first, D-002 stack):**

- pnpm project (Node 24, pnpm 11): `package.json`, `tsconfig.json` (strict), `next.config.mjs` (standalone output), `postcss.config.mjs`, `eslint.config.mjs` (flat, typescript-eslint), `pnpm-workspace.yaml` (build-script approvals), `.gitignore`, `.env.example` (template only — no secrets committed)
- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 app shell: `src/app/{layout,page,globals.css}` (placeholder home page — real landing page is Task 1.3)
- Prisma 7 + PostgreSQL: `prisma/schema.prisma` (MVP application models: `Lead`, `LeadEvent`, `Meeting`, `FollowUp`; enums `LeadStatus`, `InterestType`, `MeetingStatus`), `prisma.config.ts`, `src/server/db/prisma.ts` (PrismaPg adapter, per ecosystem convention)
- Dependencies installed (`pnpm install`); Prisma Client generated to `src/generated/prisma`

**Tests / verification performed:**

- `pnpm exec prisma validate` — PASS (schema valid)
- `pnpm exec prisma generate` — PASS (client generated)
- `pnpm lint` — PASS (0 errors, 0 warnings)
- `pnpm typecheck` (`tsc --noEmit`) — PASS
- `pnpm build` (production, standalone) — PASS (`/` prerendered)

**Notes:**

- Schema keeps the CRM lifecycle as the Owner-approved initial model (D-003) — statuses are enum-backed and extensible.
- Better Auth auth tables intentionally NOT in the application schema (ecosystem convention); admin authentication is a later Phase 1 task.
- Local PostgreSQL is NOT yet provisioned/migrated — next prerequisite.

### Task 1.2 — Local PostgreSQL + initial migration + data-layer smoke test — 🟩 DONE (2026-09-08)

**Implemented:**

- Git initialized; clean baseline commit of Task 1.1 BEFORE migration work (18 tracked files; `.env`/secrets confirmed ignored).
- `docker-compose.yml` — local dev PostgreSQL 16 (postgres:16-alpine), container `neolife-db`, named volume, healthcheck. **Port 5433** (not 5432) to avoid clashing with other local PostgreSQL instances. Local development only — NOT production infrastructure.
- `.env` (gitignored, local dev values) + `.env.example` updated to port 5433.
- Initial migration applied: `prisma/migrations/20260908191429_init/` (Lead, LeadEvent, Meeting, FollowUp + enums and indexes).
- `scripts/smoke.ts` — end-to-end data-layer smoke test.

**Tests / verification performed:**

- `docker compose up -d` → `neolife-db Up (healthy)` on `localhost:5433`
- `prisma migrate dev --name init` → migration created & applied; database in sync
- Smoke test (`pnpm exec tsx scripts/smoke.ts`) — **11/11 PASS**: lead created with attribution + consent record/timestamp → defaults to NEW_LEAD; first-party lead event created; meeting defaults SCHEDULED; follow-up created; status lifecycle update (QUALIFIED); meeting ATTENDED + outcome; relations readable; leads queryable by `utmCampaign`; deletion/cleanup verified
- `pnpm lint` — PASS · `pnpm typecheck` — PASS
- `git check-ignore .env` — confirmed ignored (no secrets in repo)

### Task 1.3 — Public landing page — 🟩 DONE (2026-09-08)

**Implemented (local-first, no new dependencies):**

- Public landing page (`/`) with: sticky header + mobile menu, hero/value proposition with primary & secondary CTAs, "The Opportunity" pillars, "How It Works" 4-step journey (learn → register interest → office meeting → start with support — mirrors the approved funnel), "Support" section, FAQ (native `<details>`), final CTA section reserved for Task 1.5 lead capture, footer with legal navigation and conservative disclosure strip.
- Placeholder legal/info pages with Owner/legal-review markers: `/privacy`, `/terms`, `/disclosures` (via reusable `InfoPageLayout`/`InfoSection`), plus `/register-interest` CTA destination placeholder (to be replaced by Task 1.5 lead capture).
- Reusable components for future campaign landing pages: `src/components/ui/{CtaLink,Section,Reveal}.tsx`, `src/components/landing/*` (SiteHeader, SiteFooter, Hero, OpportunitySection, HowItWorksSection, SupportSection, FaqSection, CtaSection).
- Compliance-safe copy only: no income guarantees, no earnings claims, no medical/therapeutic claims; all compliance-sensitive wording is conservative and explicitly marked `OWNER/LEGAL REVIEW` in code.
- Brand tokens in `globals.css` (placeholder green palette), subtle IntersectionObserver scroll-reveal with `prefers-reduced-motion` support, visible `:focus-visible` outlines.

**Tests / verification performed:**

- `pnpm lint` — PASS (0 errors, 0 warnings) · `pnpm typecheck` — PASS
- `pnpm build` (production, standalone) — PASS; 5 routes prerendered: `/`, `/privacy`, `/terms`, `/disclosures`, `/register-interest`
- Production server runtime check: all 5 routes return **HTTP 200**; home page content verified (hero, CTAs, disclosure wording present); no build errors
- Data layer re-verified after changes: `scripts/smoke.ts` — **11/11 PASS** (Task 1.2 work intact)
- Mobile/responsive and visual (desktop + mobile widths): implemented via responsive Tailwind breakpoints (mobile menu, stacked layouts); final visual sign-off is an Owner review item (see limitations)

**Known limitations:**

- `/register-interest` is an intentional placeholder until Task 1.5 (lead capture).
- Office contact details and brand assets (logo, exact brand colours) are placeholders pending Owner supply.
- Legal page wording is structural placeholder pending Owner/legal review (§11.6 launch gate).
- No automated E2E tests yet (Task 1.11); page verified by build + runtime HTTP/content checks.

### Task 1.5 — Lead capture (public → PostgreSQL) — 🟩 DONE (2026-09-08)

**Implemented:**

- Real interest-registration form on `/register-interest` (replaces Task 1.3 placeholder): premium Task 1.3-consistent design, mobile-first, accessible labels, `aria-invalid`/`role="alert"` feedback, success state, in-flight "Submitting…" guard against accidental double-submit, links to Privacy/Terms/Disclosures, clear post-submission explanation, conservative results-vary note.
- Server Action (`src/app/actions/lead.ts`) — the public funnel's first real prospect record:
  - Server-side Zod validation (never trusts client), length caps on every field, phone normalization (`normalizePhone`), honeypot field (`website`), in-memory rate limiter (5 req/min/IP, `src/lib/rateLimit.ts`), generic error responses (no DB/internal error leakage), Next.js Server-Action origin checks (CSRF mitigation), Prisma parameterized queries (SQLi safe), React escaping (XSS safe).
  - Persists via existing `Lead` model: `consent: true` + `consentAt` timestamp recorded; default status `NEW_LEAD`; duplicate-submission guard (active lead with same phone → friendly "already registered" response, no new record).
  - Attribution boundary respected: `utm_*`, `firstTouchSource`, `landingPage` left null with a documented integration point for Task 1.4.
- Automated tests (Vitest, `vitest.config.ts` with `@` alias): `tests/lead-validation.test.ts` (10 tests: valid, missing consent, short/oversized name, missing/invalid phone, invalid email, invalid interestType, honeypot, normalization), `tests/rate-limit.test.ts` (2), `tests/lead-persistence.test.ts` (2, real local DB: persistence with consent/timestamp/`NEW_LEAD`, attribution fields null, duplicate guard).
- Playwright E2E written (`e2e/lead-capture.spec.ts` + `playwright.config.ts`): `/` → Register Your Interest → validation error without consent → valid submit → success state. **NOT YET EXECUTED** (see limitations).

**Tests / verification performed:**

- `pnpm lint` — PASS · `pnpm typecheck` — PASS · `pnpm build` — PASS (5 routes prerendered)
- `pnpm test` — **14/14 PASS** (incl. real-DB persistence test against local Docker PostgreSQL)
- `scripts/smoke.ts` data-layer smoke test — still ALL PASS (Task 1.2 intact)
- Live production-build checks: `/`, `/register-interest`, `/privacy` → HTTP 200; form page contains all fields, honeypot, consent checkbox and legal links

**Known limitations:**

- Playwright browser download is blocked in this environment (revision 1243 unavailable locally, download fails) → the E2E spec is written but not yet executed. Compensating verification: unit tests + real-DB integration test + smoke test + live HTTP/content checks. Run `pnpm exec playwright install chromium` when network allows, then `pnpm exec playwright test`.
- Rate limiter is in-memory (per-process) — adequate for single-instance MVP; revisit with production topology.
- Consent wording is conservative placeholder pending Owner/legal review (§11.6 launch gate).

### Next tasks

- 1.2 Local PostgreSQL (Docker) + initial migration — 🟩 DONE (2026-09-08, 11/11 smoke assertions PASS)
- 1.3 Public landing page (business opportunity, disclosures structure, CTAs) — 🟩 DONE (2026-09-08)
- 1.4 Campaign landing-page capability + UTM/attribution capture — ⚪ NOT STARTED
- 1.5 Lead capture (server-side validation, consent + timestamp, PII minimization) — 🟩 DONE (2026-09-08, 14/14 tests PASS; browser E2E written, pending browser install)
- 1.6 Qualification flow — ⚪ NOT STARTED
- 1.7 Admin auth (Better Auth) + CRM/admin interface — ⚪ NOT STARTED
- 1.8 Office pipeline (meeting record/status/outcome) + follow-up — ⚪ NOT STARTED
- 1.9 Funnel events + basic first-party analytics — ⚪ NOT STARTED
- 1.10 Privacy/Terms/Disclaimer structures (placeholder copy) — ⚪ NOT STARTED
- 1.11 Tests (unit + E2E critical path) — ⚪ NOT STARTED

**Pending pre-launch owner decisions (do not block local dev):** hosting/domain, ad platforms & tracking, final legal copy, meeting-model confirmation (§19, `DECISIONS.md`).

### Deployment milestone (§11.7) — ⚪ NOT STARTED

Recorded by Owner (D-010): early production deployment of the landing page/MVP slice is authorized once the landing page passes local checks AND explicit Owner production-deployment authorization is given at that gate. Requires hosting/domain decision (§19 item 5) before the server step.

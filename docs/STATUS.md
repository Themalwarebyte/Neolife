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

### Task 1.4 — Campaign landing + UTM/attribution capture — 🟩 DONE (2026-09-08)

**Implemented:**

- **Attribution library** (`src/lib/attribution.ts`): validates/constrains untrusted UTM parameters (`utm_source/medium/campaign/content/term`, safe charset `A-Za-z0-9 _-./+:()%`, max 120 chars; landing page path max 200, must start with `/`). Invalid values are **dropped, never invented**. URLSearchParams parser + safe localStorage serializer/parser (never trusts storage content).
- **First-touch capture** (`src/components/tracking/AttributionCapture.tsx`, mounted in root layout): on any landing URL with UTM parameters, stores first-touch attribution (incl. landing page path) in **first-party localStorage**. Later campaign visits **never overwrite** first-touch (`resolveFirstTouch` — existing always wins). No cookies, no third parties, no fingerprinting.
- **Campaign landing-page capability**: `/campaign/[campaign]` dynamic route reusing the Task 1.3 visual system and approved copy (no invented per-campaign content). Slug validated `^[a-z0-9][a-z0-9-]{0,59}$` → invalid slugs 404. Example destination: `/campaign/launch?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch`.
- **Lead integration**: `LeadForm` reads stored first-touch attribution and submits it as hidden fields; the server action re-validates everything via `parseAttributionPayload` (charset/length, XSS/log-injection safe) and `persistLead` stores `utmSource/utmMedium/utmCampaign/utmContent/utmTerm/landingPage/firstTouchSource` — only when validly present, never invented. `firstTouchSource` is derived server-side from the validated first-touch `utm_source`.

**Attribution behavior:** AD → campaign landing (or any landing URL) → first-touch stored on device → later visits do not overwrite → lead submission inherits first-touch attribution → lead record carries full source/campaign attribution.

**Tests / verification performed:**

- `pnpm lint` — PASS · `pnpm typecheck` — PASS · `pnpm build` — PASS (now includes dynamic `/campaign/[campaign]`)
- `pnpm test` — **29/29 PASS**: attribution (13: no-params→nothing invented, valid capture, URLSearchParams parsing, malformed/XSS/log-injection values dropped, oversized trimmed to safe max, landing-path validation, first-touch never overwritten incl. landing page, storage round-trip, corrupt storage rejected), lead validation (10), rate limiting (2), persistence (4 incl. attribution reaches the lead record + unsafe attribution dropped)
- `scripts/smoke.ts` — ALL PASS · Task 1.5 tests all still pass
- Live production-build checks: `/` 200 · `/campaign/launch` 200 · `/campaign/Launch!!` → **404** (slug validation) · `/register-interest` 200

**Known limitations:**

- Playwright Chromium still unavailable (download blocked) — E2E not executed (Task 1.5 limitation carried forward, unchanged).
- First-touch is device-local (localStorage): a visitor who switches device/browser before submitting is not linkable to the original visit — acceptable for a privacy-conscious MVP (no fingerprinting per authorization).
- Attribution is stored only on the lead at submission; anonymous visit-event logging (pure first-party counters) was deliberately not added (scope: attribution only).

### Task 1.7 — Admin authentication + basic CRM — 🟩 DONE (2026-09-08)

**Authentication (Better Auth 1.7.2, Owner-approved architecture):**
- `src/lib/auth.ts` — `betterAuth()` with Prisma adapter (postgresql) + email/password enabled; `user.additionalFields.role` (default "staff", `input:false` so clients cannot self-assign).
- Better Auth auth tables added to `prisma/schema.prisma` (`User` incl. `role`, `Session`, `Account` incl. `issuer`/`subject`/`password`, `Verification`) + migrations.
- `src/app/api/auth/[...all]/route.ts` — `toNextJsHandler(auth)`.
- Admin provisioning via `scripts/seed-admin.ts` (reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` env, sets role `admin`; passwords hashed by Better Auth, never stored plaintext). No public sign-up route.

**Authorization boundary:**
- `src/server/auth/requireAdmin.ts` — server-side session verification (Better Auth loaded lazily to keep Node deps out of the client-reference graph); only `role === "admin"` users can access CRM.
- Protected route group `src/app/admin/(protected)/layout.tsx` redirects unauthenticated/non-admin to `/admin/login`.

**CRM:**
- `/admin/leads` — protected lead list (name, phone, email, location, interest, status, source/campaign, created, meeting/follow-up indicators); responsive table + mobile cards.
- `/admin/leads/[id]` — protected detail (full contact, consent + timestamp, full attribution, meetings, follow-ups, recent events).
- Lead status management (`updateLeadStatus` action) records a `status_changed` event; follow-up notes (`addFollowUp` action) record a `follow_up_added` event. Statuses validated against the approved enum (membership only, no workflow engine).

**Security controls:** server-side auth + authorization on every CRM read/write; IDOR prevented (unauthenticated/non-admin cannot reach any lead); UUID validation on route params and form input; input validation on status/note; Prisma parameterized queries (SQLi safe); React escaping (XSS safe); generic error messages (no internal leakage); no PII in URLs beyond the lead UUID; no secrets committed (`.env` gitignored, `ADMIN_*` in `.env.example` only).

**Tests / verification performed:**
- `pnpm lint` PASS · `pnpm typecheck` PASS · `pnpm build` PASS (routes: `/admin/leads`, `/admin/leads/[id]`, `/admin/login`, `/api/auth/[...all]` present)
- `pnpm test` — **36/36 PASS** (new `tests/auth.test.ts`: sign-up default role `staff`, password hashed not plaintext, correct sign-in creates a session, wrong password rejected; status/follow-up validation)
- `scripts/smoke.ts` — ALL PASS (Task 1.2 intact)
- Live production-build verification: `/admin/leads` unauthenticated → **307 → /admin/login**; `/admin/login` 200; sign-in via `/api/auth/sign-in/email` → **200** (cookie set); authenticated `/admin/leads` → **200** (heading rendered); public routes `/`, `/register-interest`, `/campaign/launch` still 200

**Known limitations:**
- Admin provisioning is env-seed based (no self-service admin creation) — documented as the chosen MVP mechanism; additional admin accounts are added by re-running the seed with different credentials or direct DB access.
- Single role boundary ("admin" vs "staff"); no per-lead ownership — appropriate for a single-office MVP.
- Playwright Chromium still unavailable — E2E not executed (unchanged).

### Next tasks

- 1.2 Local PostgreSQL (Docker) + initial migration — 🟩 DONE (2026-09-08, 11/11 smoke assertions PASS)
- 1.3 Public landing page (business opportunity, disclosures structure, CTAs) — 🟩 DONE (2026-09-08)
- 1.4 Campaign landing-page capability + UTM/attribution capture — 🟩 DONE (2026-09-08, 29/29 tests PASS, first-touch preserved)
- 1.5 Lead capture (server-side validation, consent + timestamp, PII minimization) — 🟩 DONE (2026-09-08, 14/14 tests PASS; browser E2E written, pending browser install)
- 1.6 Qualification flow — ⚪ NOT STARTED
- 1.7 Admin auth (Better Auth) + CRM/admin interface — 🟩 DONE (2026-09-08, 36/36 tests PASS, auth verified live)
- 1.8 Office pipeline (meeting record/status/outcome) + follow-up — ⚪ NOT STARTED
- 1.9 Funnel events + basic first-party analytics — ⚪ NOT STARTED
- 1.10 Privacy/Terms/Disclaimer structures (placeholder copy) — ⚪ NOT STARTED
- 1.11 Tests (unit + E2E critical path) — ⚪ NOT STARTED

**Pending pre-launch owner decisions (do not block local dev):** hosting/domain, ad platforms & tracking, final legal copy, meeting-model confirmation (§19, `DECISIONS.md`).

### Deployment milestone (§11.7) — ⚪ NOT STARTED

Recorded by Owner (D-010): early production deployment of the landing page/MVP slice is authorized once the landing page passes local checks AND explicit Owner production-deployment authorization is given at that gate. Requires hosting/domain decision (§19 item 5) before the server step.

# NEOLIFE — Project Status

Phase/step-by-step implementation status. Authoritative scope lives in `PROJECT_PLAN.md`.

---

## 📍 CURRENT STATE SUMMARY

> **Read this first.** Everything below this line is a dated, historical milestone
> entry. Those entries keep the test counts, deployment states, and prerequisites
> that were true *at the time they were written* — they are a log, not a status
> page. This summary is authoritative. Where the two disagree, this summary wins.

**As of: 2026-10-01**

| | |
|---|---|
| **Current phase** | PHASE 1 — Traffic MVP · 🟩 COMPLETE (deployed) |
| **Production** | 🟩 **LIVE** at `https://neolife.ooflowdesk.com` |
| **Production image** | `neolife-web:b371fcf` — ⚠️ **predates the P-2 fixes; deployment pending** |
| **Branch** | `master` |
| **Official test count** | **247 total** = 179 (no `DATABASE_URL`) + 68 (DB-enabled) |
| **E2E** | 🟩 **11/11 PASS** — 5 specs, 0 failed, 0 skipped, 0 flaky |
| **Database** | 10 Prisma migrations, all reconciled and applied |

### 🟩 Completed

- **Phase 0** — project foundation and planning
- **Phase 1 (Traffic MVP)** — all tasks 1.1–1.11; landing page, lead capture,
  attribution, CRM, meetings, follow-ups, audit trail
- **CRM phases A–D** — ownership scoping, Owner-controlled lead assignment,
  role-aware authorization, staff status changes
- **P-1 — Registration / business-interest flow** (2026-09-18, D-026 + D-032) —
  single-use qualification tokens, registration capture, transactional persistence
- **Funnel tracking** — first-party `FunnelEvent` capture (D-029), no-PII device
  identity (D-031), full funnel flow `visitor_landing` → `lead_created` →
  `lead_qualified` → `registration_start` → `registration_complete`
- **P-2 — Admin user management 🟩 DONE.** Owner-only `/admin/users`; Staff account
  creation; temporary-password and forced password-change flow; Staff
  activation/deactivation; inactive Staff locked out of the CRM; Owner/admin protected
  from deactivation; Better Auth opaque user IDs supported; lead assignment working with
  real Better Auth Staff IDs. Covered by real Server Action regression tests
  (`tests/admin-actions.test.ts`, 23 tests) and verified end-to-end: Admin User
  Management E2E passes and the full Playwright suite is 11/11.
- **Deterministic local E2E environment** — standalone asset preparation, fail-loud
  server binding, guarded local-only fixture seeding (`7c31712`)
- **Prisma user-relation schema alignment** (`f709b64`) — see the entry below
- **Deployed functionality** — two production releases recorded in `docs/CHANGELOG.md`
  (`neolife-web:11e64fa`, `neolife-web:b371fcf`), including the D-020 official
  product/category image rebuild. Production currently serves `b371fcf`.

### P-2 defect history (how it was found)

Worth recording, because the symptom was misleading. Both `toggleUserActive` and
`assignLead` validated user IDs with a UUID regex, but Better Auth generates opaque
~32-character alphanumeric IDs — so every real user ID was rejected before reaching the
database. `toggleUserActive` silently no-opped and `assignLead` returned
"Invalid assignee." for every real Staff user. Fixed in `73d73e0`. The E2E suite could
not have surfaced it while the environment was unreliable, which is why the environment
work in `7c31712` preceded the green run.

### Prisma schema reconciliation (`f709b64`)

`Lead.assignedUserId` and `LeadEvent.userId` were declared `@db.Uuid` while the
migrations and the live database both use `TEXT`. Verified with
`prisma migrate diff --from-migrations` that generating a migration from the schema as it
stood proposed `DROP COLUMN "assignedUserId", ADD COLUMN "assignedUserId" UUID` — which
would have destroyed every lead-ownership assignment and every audit-event actor, and
could never have stored a Better Auth ID again.

The annotations were removed. **No migration was required and no database change was
made** — the migrations and database were already correct. This brings the schema in
line with `User.id`, and with `Meeting.userId` / `FollowUp.userId`, which were already
declared without the annotation.

**Residual Prisma drift remains OPEN** and is *not* resolved by that commit:

1. `FunnelEvent.leadId` foreign key omits the `ON UPDATE CASCADE` the schema declares
2. `QualificationToken.leadId` foreign key omits the `ON UPDATE CASCADE` the schema declares
3. `FunnelEvent.createdAt` is `TIMESTAMP` where the schema wants `TIMESTAMP(3)`
4. `QualificationToken` `expiresAt` / `consumedAt` / `createdAt` lack `(3)` precision

These are non-destructive but mean a future `prisma migrate dev` **will** generate a
migration. It requires separate investigation before that is run.

### ⚠️ Production release gap

Production is live on `neolife-web:b371fcf`, an image that **predates** `73d73e0`,
`7c31712`, and `f709b64`. The P-2 fixes exist in GitHub `master` only.

Until a new image is built and deployed, **lead assignment and Staff
activation/deactivation remain affected for real production users** — the same
UUID-validation defect is still in the deployed build. Do not treat P-2 as
production-complete.

### ⚪ Not started / not authorized

- **Paid advertising** — NOT AUTHORIZED; still gated behind the §11.6 launch gate
  (`PROJECT_PLAN.md` D-001, `DEPLOYMENT_EXECUTION_PLAN.md`).
- **Phase 2 — Conversion & CRM Deepening**, and Phases 3–8.
- **D-021 email provider** — still provider-agnostic, NOT YET SELECTED
  (`src/lib/email.ts`, default `none`/`dummy`).

### Open technical issues

1. **Production deployment of `73d73e0` / `7c31712` / `f709b64`** — not yet deployed.
2. **Residual Prisma drift** — the four items listed above.
3. **`admin-actions` DB-test flakiness** — roughly 1 in 6 full-suite runs fails under
   parallel execution, because several suites write to the same database concurrently.
4. **Accumulated local `e2e-staff-*` fixture users** — the P-2 spec creates one per
   attempt, amplified by `retries: 2`.
5. **Untracked `.kilo` worktree artifacts** — nested full copies of this repository on
   disk. They cause `pnpm exec eslint .` to exit 1 on this machine and are excluded from
   Playwright discovery via `testIgnore`. Not a repository defect: tracked source lints
   clean and a fresh clone is unaffected.
6. **Misleading test comment** — `tests/assignment-reassignment.test.ts:16` claims those
   DB tests verify the actual `assignLead` action; they verify the pure helper. Real
   Server Action coverage lives in `tests/admin-actions.test.ts`.

### Superseded historical claims

These were true when written and are retained below as history. Do not re-use them:

- "Deployment NOT STARTED" / "no hostname/route for `neolife.ooflowdesk.com`" —
  superseded; production is live.
- "Local PostgreSQL is NOT yet provisioned/migrated" and "Better Auth auth tables
  intentionally NOT in the application schema" — superseded; 10 migrations applied.
- "Playwright browser download is blocked in this environment" — superseded; E2E runs
  on system Chrome.
- "P-2 E2E validation is not complete" / "fails at the deactivation step" — superseded;
  P-2 is complete and the suite is 11/11. See the defect history above.
- Test counts such as `43/43`, `29/29`, `36/36`, `167 pass`, `222 total` — historical
  baselines. The official total is **247**.

---

## Fix — admin seed path-alias resolution — 🟩 DONE locally (2026-09-12)

- Root cause: `tsx` couldn't resolve `@/*` aliases inside the production image (no `tsconfig.json` in the runtime stage).
- Fix: Dockerfile now copies `tsconfig.json` into the runtime image.
- Verified end-to-end in a disposable container: migrations applied, `seed-admin.ts` created a fake admin (`role=admin`) with a password credential account.
- Validation: lint/typecheck PASS · 43/43 tests PASS · build PASS · Docker build PASS · seed-container test PASS.
- Production: NOT yet redeployed (awaiting Owner deployment authorization).

## Visual Pass 3 — richer photographic rhythm — 🟩 DONE locally (2026-09-11)

- Added background photography to How It Works (`how-it-works.webp` + cream/green gradient overlay) and FAQ (`faq.webp` + cream overlay), and enlarged the Opportunity and Products photographs with botanical accents.
- 7 self-hosted photography assets now present; 2 new (Unsplash License, documented in `public/images/landing/README.md`).
- Validation: lint/typecheck PASS · 43/43 tests PASS · build PASS · E2E 1/1 PASS. Not deployed.

## Visual polish — Final CTA + button contrast — 🟩 DONE locally (2026-09-10)

- Final CTA uses the real `final-cta.webp` as a full-bleed background with a dark forest-green gradient overlay (fixed `relative`/`absolute` conflict).
- Primary CTA buttons are now `bg-brand-700` (white text, ~5.5:1 contrast) with `hover:bg-forest-700`; final-CTA button fixed (was white-on-white from conflicting class overrides).
- Validation: lint/typecheck PASS · 43/43 tests PASS · build PASS · E2E 1/1 PASS. Not deployed.

## Visual Pass 2 — Photography (real imagery) — 🟩 DONE locally (2026-09-10)

- Replaced all botanical photographic placeholders with real self-hosted WebP photography (Unsplash License) across Hero, Opportunity, Products/Wellness, Support, and Final CTA.
- Files: `public/images/landing/{hero,opportunity,wellness,support,final-cta}.webp` + `README.md` asset manifest (source IDs/URLs, license, usage, sizes).
- `src/components/ui/Photo.tsx` reusable image system now receives `src="/images/landing/*.webp"` in all five slots.
- Config: `images.unoptimized: true` (pre-optimized WebP served directly; no `sharp` dependency); Dockerfile now copies `public/` into the standalone output.
- **Validation:** lint PASS · typecheck PASS · 43/43 tests PASS · build PASS · E2E 1/1 PASS · all 5 images serve `image/webp` (HTTP 200) in a disposable Docker container · CSS regression 200 `text/css` · `/health` 200.
- **Production:** NOT deployed (local-first). Awaiting Owner review before a review deployment.

## FINAL §11.6 reconciliation (2026-09-08)

- **Legal baseline:** 🟩 **MVP LEGAL BASELINE COMPLETE** (Privacy, Terms, Disclosures, business-relationship, earnings/results, product/medical, consent, footer wording). Future-revisable; not legal advice.
- **E2E:** 🟩 COMPLETE — Playwright 1/1 PASS via system Chrome.
- **Production preparation:** 🟩 COMPLETE — `docs/DEPLOYMENT.md` runbook + env spec created; server inspected read-only.
- **Deployment:** ⚪ NOT STARTED · **Paid advertising:** ⚪ NOT AUTHORIZED. *(Deployment figure superseded 2026-10-01 — production is live. Paid advertising remains NOT AUTHORIZED.)*
- **§11.6:** 🟨 OPEN — remaining launch gates are deployment-dependent (hosting/domain config, production secrets, production smoke test, compliance review before ads).

## Launch-Gate Readiness Audit (§11.6 / §11.7) — superseded by reconciliation above

Read-only audit (no new features, no deploy, no paid ads). Verified against live codebase, fresh production build, and live runtime.

- **Verified green:** 43/43 tests PASS · lint/typecheck/build PASS · standalone server serves · all public routes 200 · `/admin/leads` unauthenticated → 307 → `/admin/login` · no third-party tracking/fingerprint/external fetch · `.env` ignored, only placeholder `.env.example` tracked, **no secret/token anywhere in the repo**.
- **Gaps resolved by Owner decisions (D-012–D-016):** advertising platform (Meta only) · tracking (first-party only) · hosting target (`neolife.ooflowdesk.com`) · legal baseline (COMPLETE) · security headers + `/health` (implemented).
- **Remaining (deployment-time only):** hosting/domain + DNS/HTTPS/Cloudflare tunnel configuration · production secrets · production smoke test · Owner deployment authorization.
- **§11.6 and §11.7 remain OPEN.**

## Pre-launch hardening — 🟩 DONE (2026-09-08, Owner decisions D-012–D-016)

- **Security headers** (`next.config.mjs` `headers()`): X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, HSTS, and a CSP (`default-src 'self'`; script/style `'unsafe-inline'` for Next inline scripts/Tailwind; `'unsafe-eval'` only in dev; `connect-src 'self'`; `frame-ancestors 'none'`; `object-src 'none'`). Verified live on the production build — CSP correctly omits `'unsafe-eval'` in prod.
- **`/health` endpoint** (`src/app/health/route.ts`): public, minimal, returns `{"status":"ok"}`, no DB dependency, no secrets/PII. Verified 200.
- **Legal documents** = 🟩 **MVP LEGAL BASELINE COMPLETE** (Privacy, Terms, Disclosures, business-relationship, earnings/results, product/medical, consent, footer). Future-revisable; not legal advice.
- **E2E:** recovered — now runs via system Chrome (`channel: "chrome"`), **1/1 PASS**.

**Tests/verification:** `pnpm lint`/`typecheck`/`build` PASS · `pnpm test` 43/43 PASS · `/health` 200 · security headers present on `/` · all public routes 200 · `/admin/leads` unauth → 307 · sign-in 200 · authenticated `/admin/leads` 200 (CSP-compatible).

## E2E recovery + deployment preparation — 🟩 DONE (2026-09-08, no deploy)

- **E2E recovered without downloading Chromium:** Playwright now uses the system-installed Google Chrome via `channel: "chrome"` (`playwright.config.ts`). `pnpm exec playwright test` → **1/1 PASS** (lead-capture journey). webServer command corrected to `node .next/standalone/server.js`.
- **UX finding (🟡, noted for Owner):** React 19 auto-resets uncontrolled form fields after each form action, so a validation error clears the user's entered data. Recommend making the lead form controlled in a later task.
- **Server inspection (read-only, via `ooflowdesk-remote` SSH):** Docker 29.8.0; per-project compose dirs, `<project>-tunnel` (cloudflared), Caddy gateways, postgres:16. No `neolife.ooflowdesk.com` route exists yet; no conflicting service. `secrets/` and tunnel credential dirs were **not read** (contain credentials).
- **`docs/DEPLOYMENT.md` created** — production architecture, isolated `neolife` service proposal, production env vars (names only), migration strategy, 17-step runbook, rollback/backup, security notes. **No production secrets included.**
- `NEXT_PUBLIC_SITE_URL` confirmed unused by application code (0 references).

## §11.7 Deployment Pre-flight — 🟨 READY FOR OWNER DEPLOYMENT AUTHORIZATION (2026-09-08)

- **Local release:** app code at commit `3994e9d` (HEAD `c066473` is docs-only on top). Working tree clean; `pnpm test` 43/43 · lint/typecheck/build PASS · E2E 1/1 PASS · standalone `server.js` present.
- **Server pre-flight (read-only, access restored):** Docker 29.8.0 · no `neolife` project/network/container/route exists · `/opt/ooflowdesk/neolife` absent · resources: 169G disk free, ~5.9G RAM, 4 cores · `neolife.ooflowdesk.com` **already resolves publicly (A+AAAA)**.
- **Isolation confirmed additive:** dedicated `neolife` dir + `neolife` network + `neolife-web` (internal 3000) + `neolife-postgres` (internal 5432) + `neolife-tunnel`; no host port needed; no shared resource touched.
- **Remaining Owner actions:** provision production secrets · create/provide the dedicated Cloudflare Tunnel connector token for `neolife.ooflowdesk.com` (or confirm an existing route) · explicit deployment authorization.
- **§11.7 ⚪ NOT STARTED · Production deployment NOT AUTHORIZED · Paid advertising NOT AUTHORIZED.** *(Deployment figures superseded 2026-10-01 — the deployment was executed and production is live. Paid advertising remains NOT AUTHORIZED.)*
- **Deployment execution plan:** `docs/DEPLOYMENT_EXECUTION_PLAN.md` — **🟩 READY FOR OWNER DEPLOYMENT DECISION**. Secret architecture **A** (env-var injection) accepted by the Owner. Accurate wording: the root-only `neolife.env` protects the *source file*; because the existing `ooadmin` account has root-equivalent Docker privileges, injected container env is technically inspectable by it; NEOLIFE does not modify this privilege model; Kilo must not intentionally inspect/print/log/expose secrets.

## Visual/conversion upgrade (Owner-approved) — 🔵 IN PROGRESS (implemented locally, not deployed/accepted)

Public homepage visual redesign (Semrush-level UX polish + NeoLife botanical/wellness identity). Implemented **locally** per `docs/DESIGN_UPGRADE_PLAN.md`: botanical hero, trust strip, pale-green Opportunity, cream How-It-Works, deep-forest Products/Wellness, image+card Support, FAQ, deep-forest CTA, dark footer. Funnel, attribution, auth, CRM, meetings, security, and legal baseline are untreated/unchanged. **Not marked DONE until Owner review/acceptance.**

## PHASE 1 — TRAFFIC MVP 🟩 COMPLETE

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
- Better Auth auth tables intentionally NOT in the application schema (ecosystem convention); admin authentication is a later Phase 1 task. *(Superseded — auth tables and admin authentication were both implemented.)*
- Local PostgreSQL is NOT yet provisioned/migrated — next prerequisite. *(Superseded — local PostgreSQL is provisioned and all 10 migrations are applied.)*

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
   - Playwright E2E written (`e2e/lead-capture.spec.ts` + `playwright.config.ts`): `/` → Register Your Interest → validation error without consent → valid submit → success state. 🟩 EXECUTED — 10/10 E2E PASS via system Chrome.

**Tests / verification performed:**

- `pnpm lint` — PASS · `pnpm typecheck` — PASS · `pnpm build` — PASS (5 routes prerendered)
- `pnpm test` — **14/14 PASS** (incl. real-DB persistence test against local Docker PostgreSQL)
- `scripts/smoke.ts` data-layer smoke test — still ALL PASS (Task 1.2 intact)
- Live production-build checks: `/`, `/register-interest`, `/privacy` → HTTP 200; form page contains all fields, honeypot, consent checkbox and legal links

**Known limitations:**

- Playwright browser download is blocked in this environment (revision 1243 unavailable locally, download fails) → the E2E spec is written but not yet executed. Compensating verification: unit tests + real-DB integration test + smoke test + live HTTP/content checks. Run `pnpm exec playwright install chromium` when network allows, then `pnpm exec playwright test`. *(Superseded — E2E now runs against system Chrome via `channel: "chrome"`; see the Current State Summary above.)*
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

### Task 1.8 — Office pipeline actions (meetings) — 🟩 DONE (2026-09-08)

**Implemented:**
- Meeting scheduling in the CRM: `scheduleMeeting` server action + `MeetingForm` (date/time + notes) on the lead detail page; creates a `Meeting` (default `SCHEDULED`) and records a `meeting_scheduled` event.
- Meeting status/outcome/notes management: `updateMeeting` server action + `MeetingUpdateForm` per meeting (status select, outcome, notes); records a `meeting_status_changed` event.
- Validation (`src/lib/meetingManagement.ts`, client-safe): status enum membership, datetime parsing, outcome/notes length caps (500). Server-side authorization (admin-only) on both actions; UUID validation; parameterized queries; generic errors.

**Tests / verification performed:**
- `pnpm lint` PASS · `pnpm typecheck` PASS · `pnpm build` PASS
- `pnpm test` — **43/43 PASS** (new `tests/meeting-management.test.ts` validators; `tests/meeting-persistence.test.ts` schedule → update status/outcome/notes → event, against real DB)
- Existing 36 tests all still pass; Task 1.2 smoke test unaffected (Meeting model already exercised by smoke)

**Known limitations:**
- `updateMeeting` sets status always and outcome/notes from the submitted values (empty clears them); no workflow transition engine (per plan).
- No meeting reminders/automation (later phases).

### Next tasks

#### Two-user CRM expansion

**Phase A — Authorization Foundation:** 🟩 DONE locally (2026-09-17)

- `Lead.assignedUserId` nullable UUID FK to `User.id` (`ON DELETE SET NULL`) + indexes.
- `requireCrmUser.ts`: `getCrmUser`, `requireCrmUser`, `requireAdmin`, `isAdminSession`, `CrmUser`.
- Protected layout, admin index, leads list, lead detail — ownership-scoped queries (Owner: all; Staff: assigned-only).
- Server Actions (`updateLeadStatus`, `addFollowUp`, `scheduleMeeting`, `updateMeeting`) — `requireCrmUser` + `verifyLeadOwnership`.
- Migration `20260917000000_add_lead_ownership` created (not yet applied to DB). *(Superseded — applied and reconciled; see the Current State Summary above.)*
- Typecheck ✅ · lint clean (changed files) · 15/15 new pure tests pass.

**Phase B — Owner-controlled lead assignment:** 🟩 DONE locally (2026-09-17)

- `D-027` recorded in `docs/DECISIONS.md` (Owner-approved Option A).
- `assignLead` Server Action — Owner-only (`requireAdmin`), target-user validated (`role = "staff"`), audit events (`lead_assigned`, `lead_unassigned`).
- `getCrmUsers` — lists Staff users for the assignment dropdown.
- `AssignmentForm` component — Owner-only dropdown (assign/reassign/unassign) on lead detail page.
- `src/lib/assignment.ts` — pure authorization helpers (`canAssignLeads`, `isAssignableRole`, `canViewLead`, `leadVisibilityWhere`).
- `scripts/seed-staff.ts` — dev/test Staff account provisioning (env-var based, no hard-coded secrets).
- Tests: `tests/assignment-authorization.test.ts` (15 pure tests, all pass) + `tests/assignment-integration.test.ts` (4 DB tests, skipped without PostgreSQL).
- Documentation: `DECISIONS.md` (D-027), `STATUS.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `RECOVERY.md` updated.

**Phase C — Canonical audit actor on LeadEvent:** 🟩 DONE locally (2026-09-18)

- `D-028` recorded in `docs/DECISIONS.md`.
- `LeadEvent.userId` nullable TEXT FK to `User.id` (`ON DELETE SET NULL`) + index — migration `20260917120000_add_leadevent_actor/migration.sql` (applied to PostgreSQL 18/WSL2).
- `LeadEvent.type` kept as `String` (not migrated to enum).
- All Server Actions set `userId` from the authenticated server-side CRM user: `status_changed`, `follow_up_added`, `meeting_scheduled`, `meeting_status_changed`, `lead_assigned`, `lead_unassigned`.
- Existing `metadata.by` retained and kept consistent with `userId`.
- Tests: `tests/assignment-reassignment.test.ts` (13: 9 pure + 4 DB), `tests/staff-status-authorization.test.ts` (16: 10 pure + 6 DB), `tests/assignment-integration.test.ts` (15: 11 pure + 4 DB). DB tests executed from WSL via tsx — **43/43 DB tests PASS** (pure tests pass from Windows; DB tests skip gracefully on Windows due to network isolation).
- All 152 Phase C tests verified: 109 pure pass + 43 DB pass = **152/152** (14 DB tests skip from Windows, run from WSL).
- Verification: lint clean ✅ · typecheck ✅ · build ✅ (Next.js 16 standalone, Turbopack) · DB schema verified (columns exist, FK constraint enforced) ✅.
- Documentation: `DECISIONS.md` (D-028), `CHANGELOG.md`, `STATUS.md`, `ARCHITECTURE.md` (LeadEvent model updated), `RECOVERY.md` (LeadEvent.userId drift scenario) updated.

- 1.2 Local PostgreSQL (Docker) + initial migration — 🟩 DONE (2026-09-08, 11/11 smoke assertions PASS)
- 1.3 Public landing page (business opportunity, disclosures structure, CTAs) — 🟩 DONE (2026-09-08)
- 1.4 Campaign landing-page capability + UTM/attribution capture — 🟩 DONE (2026-09-08, 29/29 tests PASS, first-touch preserved)
- 1.5 Lead capture (server-side validation, consent + timestamp, PII minimization) — 🟩 DONE (2026-09-08, 14/14 tests PASS; browser E2E written, pending browser install)
- 1.6 Qualification flow — 🟩 DONE (2026-09-18, Phase D)
- 1.7 Admin auth + CRM — 🟩 DONE (2026-09-17, Phase A+B)
- 1.8 Office pipeline (meetings) + follow-up — 🟩 DONE (2026-09-08, Phase D)
- 1.9 Funnel events + analytics — 🟩 DONE (2026-09-18, Phase D)
- 1.10 Privacy/Terms/Disclaimers — 🟩 DONE (2026-09-13)
- 1.11 Tests — 🟨 PARTIAL: pure tests complete; E2E not executable (browser unavailable)
- P-1 Registration/business-interest flow — 🟩 DONE (2026-09-18, D-026 full capture + D-032 Owner decision)

### Task 1.6 — Qualification flow — 🟩 DONE locally (2026-09-18)

**Implemented (Phase D):**

- **QualificationToken table** — DB-backed, durable single-use tokens. Columns: `id`, `leadId` (UUID FK, `ON DELETE CASCADE`), `nonce` (UNIQUE), `expiresAt`, `consumedAt`, `createdAt`.
- **`src/lib/qualification.ts`** + **`src/lib/qualification-client.ts`** — token system split for client/server safety:
  - Client-safe (`qualification-client.ts`): `parseToken` (structural parsing), `verifyTokenSignature`/`isTokenStructurallyValid` (pure structural + expiration check, no Prisma, no `node:crypto`), `parseQualificationInput` (notes/interestType/city validation).
  - Server-safe (`qualification.ts`): `generateQualificationToken` (creates DB record + HMAC-SHA256 signature), `consumeQualificationToken` (atomic `updateMany` with `consumedAt IS NULL AND expiresAt > NOW()` for replay protection), `validateQualificationToken` (non-consuming DB check for display).
  - Token format: `<leadId>.<expiresAt>.<nonce>.<signature>` (HMAC-SHA256 using `BETTER_AUTH_SECRET`).
  - No Lead PII embedded in the token.
- **`src/app/actions/qualify.ts`** — `qualifyLeadAction` Server Action: consumes token atomically, extracts leadId ONLY from verified token (never from client input), sets status to `QUALIFIED`, records `lead_qualified` FunnelEvent with `fromStatus`/`toStatus` metadata, rate-limited (5 req/min/IP).
- **`src/app/register-interest/qualify/page.tsx`** — qualification page receiving token as prop, rendering `QualificationForm`.
- **`src/components/leads/QualificationForm.tsx`** — client component: uses `isTokenStructurallyValid` for UX-only pre-check; server always re-validates via `qualifyLeadAction`.
- Token generated in `submitLeadAction` (Task 1.5) on lead creation, returned to client for "Continue to Qualification" flow.

**D-030 (recorded in DECISIONS.md):** Cryptographically signed, DB-backed single-use continuation token binding public qualification form to exactly one Lead.

### Task 1.9 — Funnel events + basic first-party analytics — 🟩 DONE locally (2026-09-18)

**Implemented (Phase D):**

- **FunnelEvent table** (`prisma/migrations/20260918000000_add_funnel_events/migration.sql`) — first-party funnel event tracking, separate from LeadEvent (CRM audit trail). Columns: `id`, `type`, `leadId` (UUID FK, `ON DELETE SET NULL`), `attribution` (JSONB), `deviceId` (random UUID), `metadata` (JSONB), `createdAt`. **D-031:** No `ipAddress`, `userAgent`, `firstName`, `phone`, or `userId` columns — PII minimization enforced at schema level.
- **`src/lib/funnel.ts`** — server-side `recordFunnelEvent`: validates event type against approved set (`visitor_landing`, `lead_created`, `lead_qualified`, `registration_start`, `registration_complete`), re-validates attribution via `parseAttribution`, sanitizes metadata keys/values, validates deviceId UUID format.
- **`src/lib/funnel-client.ts`** — client-safe `recordFunnelEventClient`: delegates to `/api/funnel` API route via fetch; type-restricted to `visitor_landing` and `registration_start` (client-allowed events).
- **`src/app/api/funnel/route.ts`** — API Route Handler (POST) accepting `visitor_landing` and `registration_start` from clients; all other event types silently rejected.
- **`src/components/tracking/FunnelTracker.tsx`** — client component that records `visitor_landing` on landing page load (only when UTM attribution present), with 10-minute per-device debounce. Uses shared `getOrCreateDeviceId` from `funnel-device.ts`.
- **`src/lib/funnel-device.ts`** — shared first-party device-ID utility (consolidates device logic from FunnelTracker + LeadForm).
- **`src/components/leads/RegistrationForm.tsx`** — client component that emits `registration_start` (client-side) on form mount via `recordFunnelEventClient`.
- Event recording integrated: `lead_created` recorded in `submitLeadAction` (Task 1.5), `lead_qualified` recorded in `qualifyLeadAction` (Task 1.6), `registration_start` recorded client-side when RegistrationForm mounts (P-1 Task 1), `registration_complete` recorded server-side in `registerInterestAction` after successful ProductInterest persistence (P-1 Task 1).
- Funnel event flow: `visitor_landing` → `lead_created` → `lead_qualified` → `registration_start` → `registration_complete` (where applicable).
- Rate limiting via existing `rateLimit.ts` (5 req/min/IP).

**D-029 (recorded in DECISIONS.md):** FunnelEvent table for first-party funnel/traffic measurement. No custom analytics platform. Separate from LeadEvent.

**D-031 (recorded in DECISIONS.md):** FunnelEvent does NOT store IP addresses, User-Agent strings, first names, or phones. Device identification uses anonymous `deviceId` (client-generated UUID).

**Tests / verification:**

- `pnpm lint` — PASS (all Phase D files)
- `pnpm typecheck` — PASS
- `pnpm build` — PASS (includes `/api/funnel` dynamic route, `/register-interest/qualify` dynamic route)
- `pnpm test` — 16/16 pure tests PASS (funnel-events tests updated to recognize all 5 event types; 9 DB tests skipped without PostgreSQL)

### Task 1.6 — Qualification flow — Tests & verification

- `pnpm lint` — PASS
- `pnpm typecheck` — PASS
- `pnpm build` — PASS
- `pnpm test` — 27/27 pure tests PASS (27 qualification tests, 11 DB tests skipped without PostgreSQL)
- DB integration tests (30/30 PASS from WSL): QualificationToken schema, nonce unique constraint, single-use consumption, replay prevention, durability, no PII in token, qualification workflow (status → QUALIFIED, lead_qualified event).

### Phase P-1 — Registration / business-interest flow — 🟩 DONE locally (2026-09-18)

**Scope:** Optional post-capture registration step that captures product interest, meeting/contact preference, and additional context; persists `ProductInterest`; records `registration_start`/`registration_complete` FunnelEvents.

**D-026 (full capture flow):** ProductInterest capture-action implemented (previously "a subsequent step" in D-026).

**D-032 (Owner decision):** Public registration does NOT create a `Meeting` record. `meetingPreference` is captured as metadata on the `registration_complete` FunnelEvent for CRM follow-up. Actual Meeting creation remains an authenticated CRM operation via the existing `scheduleMeeting` Server Action.

**Funnel event semantics (corrected):**
- `registration_start` — emitted **client-side** when the RegistrationForm mounts (entry into the registration step). Anonymous (deviceId only, no leadId). Implemented via `recordFunnelEventClient` → `/api/funnel` API route.
- `registration_complete` — emitted **server-side only**, after successful `ProductInterest` persistence within a DB transaction. Not emitted on the client.
- Server action (`register-interest.ts`) does NOT record `registration_start`.

**New files:**
- `src/lib/registration.ts` — pure validation (productId UUID, meetingPreference enum, additionalContext ≤1000 chars).
- `src/lib/funnel-device.ts` — shared device-ID utility (consolidates FunnelTracker + LeadForm logic).
- `src/app/actions/register-interest.ts` — Server Action: validates token (non-consuming), persists ProductInterest + registration_complete in transaction.
- `src/components/leads/RegistrationForm.tsx` — client form with client-side registration_start emission.
- `tests/registration-validation.test.ts` — 16 pure tests.
- `tests/registration-persistence.test.ts` — 5 DB tests + 2 pure tests.

**Modified files:**
- `src/lib/funnel.ts` — added `registration_start`/`registration_complete` to `VALID_FUNNEL_EVENT_TYPES`.
- `src/lib/funnel-client.ts` — extended `ClientFunnelEventInput` to allow `registration_start` (was `visitor_landing` only).
- `src/app/api/funnel/route.ts` — accepts `registration_start` from clients.
- `src/components/tracking/FunnelTracker.tsx` — uses shared `getOrCreateDeviceId`.
- `src/components/leads/LeadForm.tsx` — uses shared `getOrCreateDeviceId`.
- `src/app/register-interest/qualify/page.tsx` — added RegistrationForm section.
- `tests/funnel-events.test.ts` — updated valid event-type set; added DB tests for new event types.

**Verification:**
- Lint: PASS (all new/modified files)
- Typecheck: PASS
- Build: PASS
- Tests: 149/149 pure PASS (16 new validation + 2 new persistence + all existing); 5 DB tests skipped without PostgreSQL.

### Phase 1 — Core tasks status summary

- 1.1 — Foundation/scaffolding — 🟩 DONE (2026-09-08)
- 1.2 — Local PostgreSQL + migration — 🟩 DONE (2026-09-08)
- 1.3 — Public landing page — 🟩 DONE (2026-09-08)
- 1.4 — Campaign landing + UTM/attribution — 🟩 DONE (2026-09-08)
- 1.5 — Lead capture — 🟩 DONE (2026-09-08)
- 1.6 — Qualification flow — 🟩 DONE (2026-09-18, Phase D)
- 1.7 — Admin auth + CRM — 🟩 DONE (2026-09-08)
- 1.8 — Office pipeline (meetings) + follow-up — 🟩 DONE (2026-09-08)
- 1.9 — Funnel events + analytics — 🟩 DONE (2026-09-18, Phase D)
- 1.10 — Privacy/Terms/Disclaimers — 🟩 DONE (2026-09-13)
- 1.11 — Tests — 🟩 DONE: 167 pass, 55 skipped (DB-only) (was 206/206; 16 new tests added, DB-only tests now skip without local PostgreSQL) · E2E 10/10 PASS via system Chrome

**Pending pre-launch owner decisions (do not block local dev):** hosting/domain (§19.5), ad platforms & tracking (§19.6), final legal copy (§19.7), meeting-model confirmation (§19.8).

### Phase P-2 — Admin user management (🟩 local)

**Scope:** Owner-provisioned Staff user management with forced password change on first login, activation/deactivation, and admin-only access control.

**New files:**
- `prisma/migrations/20260919000000_add_user_management_fields/migration.sql` — adds `mustChangePassword` and `isActive` to User table.
- `src/lib/user-management.ts` — Zod schemas (`createUserSchema`, `toggleUserSchema`, `changePasswordSchema`).
- `src/app/admin/(protected)/users/page.tsx` — Users management page (Owner-only, server-rendered).
- `src/app/admin/(protected)/users/create-user-form.tsx` — client create-user form with `useActionState`.
- `src/app/admin/change-password/page.tsx` — forced password-change gate (server-rendered gate).
- `src/app/admin/change-password/change-password-form.tsx` — client form with current/new/confirm password.
- `tests/user-management.test.ts` — 13 pure schema validation tests.
- `tests/user-management-db.test.ts` — 4 DB integration tests.
- `e2e/admin-user-management.spec.ts` — full workflow E2E test.

**Modified files:**
- `prisma/schema.prisma` — added `mustChangePassword Boolean @default(false)` and `isActive Boolean @default(true)` to User model.
- `src/lib/auth.ts` — registered both as Better Auth `additionalFields`.
- `src/server/auth/requireCrmUser.ts` — `getCrmUser` returns `mustChangePassword`; inactive users return null; `requireCrmUser` includes new field.
- `src/app/admin/(protected)/layout.tsx` — redirects `mustChangePassword` users to `/admin/change-password`; added "Users" nav link for Owner.
- `src/app/admin/(protected)/actions.ts` — `createCrmUser`, `toggleUserActive`, `changePasswordAction` added.
- `docs/DECISIONS.md` — D-033 recorded.
- `docs/CHANGELOG.md` — P-2 entry.

**Security verification:**
- `await requireAdmin()` on all admin-only actions (awaited — was a bug before fix).
- `toggleUserActive` prevents admin account deactivation and self-deactivation at server level.
- `role` field has `input: false` in Better Auth — clients cannot self-assign roles.
- Temp passwords hashed by Better Auth — never stored in plaintext, never logged, never returned in responses.
- Inactive users blocked from all protected routes via `getCrmUser()` null return.
- `mustChangePassword` cleared only after successful Better Auth `changePassword`.

**Verification:**
- Lint: PASS (0 errors, 0 warnings)
- Typecheck: PASS (`tsc --noEmit`)
- Tests: 167 passed, 55 skipped (DB-only)
- Build: PASS (Next.js 16.3.4 production build)
- E2E: Cannot run without DATABASE_URL + running server; test written and syntax-checked

### Deployment milestone (§11.7) — ✅ REACHED — production is LIVE

> **Superseded (2026-10-01).** This milestone has been reached: production is live at
> `https://neolife.ooflowdesk.com` serving `neolife-web:b371fcf`. The original gate text
> is retained below as history. See `docs/DEPLOYMENT.md` §0 for the production record.

Recorded by Owner (D-010): early production deployment of the landing page/MVP slice is authorized once the landing page passes local checks AND explicit Owner production-deployment authorization is given at that gate. Requires hosting/domain decision (§19 item 5) before the server step.

## Product Catalogue — IMPLEMENTED locally (2026-09-13, Owner-approved D-019–D-026)

**Committed (data layer — commit ce7cbcb):**

- `prisma/schema.prisma` — added `Category`, `Subcategory`, `Product`, `ProductCategory`, `ProductSubcategory`, `ProductInterest` models + `InterestStatus` enum; `Lead.productInterests` relation.
- `prisma/migrations/20260913061907_add_product_catalogue/migration.sql` — applied; DB in sync with schema.
- `src/lib/catalogue-data.ts` — 65 products, 4 categories, 22 subcategories (Northern Europe catalogue as **temporary development/seed data only**; D-025).
- `scripts/seed-catalogue.ts` — idempotent seed/upsert script.
- `src/lib/email.ts` — provider-agnostic email abstraction (D-021: NOT YET SELECTED, default `none`/`dummy`).

**Uncommitted (routes + UI + tests):**

- `src/app/products/*` — 4 route pages (products, category, subcategory, product detail).
- `src/components/catalogue/` — 6 components (hero, category-grid, ProductCard, search-box, SubcategoryFilter, Breadcrumb).
- `src/lib/catalogue-meta.ts` — catalogue helpers.
- `tests/catalogue-data.test.ts` — 28 tests.

**Decisions approved (2026-09-13):**

- D-019: "Contact us" pricing (`PRICE_LABEL = "Contact us"`).
- D-020: OFFICIAL NEOLIFE product images from neolifeshop.com (65 images) + category images rebuilt from actual catalogue products (D-020 REBUILT, 2026-09-16).
- D-021: Email provider remains provider-agnostic — NOT YET SELECTED.
- D-022: Concise original descriptions (not copied verbatim).
- D-023: Lightweight search/filter (in-memory).
- D-024: Dedicated subcategory routes.
- D-025: 65 products are TEMPORARY DEVELOPMENT/SEED DATA — NOT the final Kenyan catalogue.
- D-026: Separate `ProductInterest` entity (schema model + `Lead` relation committed; capture-action flow is a subsequent step).

**Verification:** Lint ✅ (0 errors) · `tsc --noEmit` ✅ · Build ✅ (9 static + 5 dynamic routes) · Tests ✅ (64/64 non-DB tests PASS; 9 DB-persistence tests fail pre-existing due to no local PostgreSQL).

**Production:** 🟩 DEPLOYED (commit 7784de5, image `neolife-web:b371fcf`). All 65 product images load (HTTP 200, `image/webp`). `/health` → 200. `/products` → 200. Category, subcategory, and product detail routes → 200. The four Browse by Category cards now show compositions of actual catalogue products (nutritionals, weight-management, personal-care, home-care; `organic-skin-care.webp` removed). Source-product mapping documented in `docs/CATEGORY_IMAGE_SOURCES.md`. Composition script: `scripts/compose-category-images.cjs`.

**Note:** Category images were rebuilt using `sharp` (devDependency) and deployed to production at commit `b371fcf` / `7784de5`. Deployment verified: all 4 category images serve `image/webp` (HTTP 200), old `organic-skin-care.webp` returns 404, product images intact, `neolife-web` container running `neolife-web:b371fcf`, health endpoint returns 200.

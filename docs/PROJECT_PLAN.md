# NEOLIFE — Master Project Plan

> **Authoritative project control document.**
> The single source of truth for the scope, order, decisions, and completion rules of the NEOLIFE business platform.
> Every future implementation task MUST begin by reading this document and identifying the current phase, task, dependencies, required decisions, and completion criteria.

**Current Phase:** PHASE 1 — TRAFFIC MVP
**Status:** 🟩 PHASE 1 COMPLETE — Phase 0 🟩 COMPLETE. All Phase 1 tasks 1.1–1.11 🟩 DONE. **222/222 tests PASS** (167 without `DATABASE_URL` + 55 DB-enabled) · E2E 11 tests via system Chrome. P-1 (Registration/business-interest flow) 🟩 DONE. P-2 (Admin user management) 🟩 implemented locally, 🟨 E2E validation in progress. **Production deployment 🟩 LIVE** at `https://neolife.ooflowdesk.com`. See `docs/STATUS.md`.

> **Test-count convention (official):** the suite contains **222 tests** in total — **167** run without `DATABASE_URL` set, plus **55** additional DB-enabled tests that require a local PostgreSQL instance. Any documentation quoting a different total (e.g. `2026/206`, `43/43`, `29/29`, `36/36`) refers to a superseded, historical baseline and must not be used as the current figure.

---

## 1. Project Overview

**NEOLIFE** is a direct-selling / network-marketing business opportunity (nutritional/wellness products) targeting the Kenyan market.

**What this platform is intended to accomplish:** to be the digital business-acquisition engine for the NEOLIFE organization — receiving paid advertising traffic, converting visitors into identifiable and trackable business prospects, qualifying them, and moving qualified prospects toward registration and an office meeting, then follow-up and promoter/business-builder conversion.

**Long-term vision:** a complete business platform (marketing, advertising, lead generation, advertising attribution, lead qualification, CRM, registration/application, office meeting management, follow-up, promoter onboarding/dashboard, customer management, product management, orders/sales, referrals, team/downline, training/business academy, marketing resources, business analytics, commission-related architecture, administration, security, audit logging, reporting, notifications, automation, monitoring, performance/scaling, production deployment, post-launch optimization).

**MVP strategy:** *Full platform blueprint → Traffic MVP → launch paid ads → collect real traffic/lead data → iterate → progressively build the full platform.*

The first objective is **NOT** to finish the entire platform. The first objective is to create a professional, secure, measurable destination for paid advertising traffic.

---

## 2. Roles & Authority

| Role | Authority |
|---|---|
| 👤 **Owner** | Final decision-maker on all business, product, architecture, security, UX/UI, technology, budget, and launch decisions. |
| 🧠 **ChatGPT** | Architect / researcher / security advisor. Researches, recommends, analyzes, challenges assumptions, reviews architecture and security, helps define requirements. Does NOT make final owner decisions. |
| 🤖 **Kilo** | Implementation agent. Inspects the codebase, implements approved work, tests, reports results, and updates this plan. Does NOT silently make critical business or architectural decisions. |

**Decision rule:** when a decision is required, Kilo stops that work item and clearly reports:

```
🟨 OWNER DECISION REQUIRED
- Phase:
- Decision:
- Option A:
- Option B:
- Kilo recommendation:
- Reason:
```

Kilo does not implement beyond the decision unless the owner approves it.

---

## 3. Project Principles

1. Plan first.
2. MVP first.
3. Launch early.
4. Measure real traffic.
5. Progressive development.
6. Security by design.
7. Do not silently make owner decisions.
8. Do not build outside approved scope.
9. Local-first development (build → test → validate → deploy → verify).
10. Production isolation.
11. Design for expansion; do not build future features speculatively.

---

## 4. Status System (exact)

| Status | Meaning |
|---|---|
| 🟩 DONE | completed, tested and accepted |
| 🔵 IN PROGRESS | currently being worked on |
| 🟨 AWAITING DECISION | requires owner decision |
| ⚪ NOT STARTED | planned but not started |
| 🔴 BLOCKED | cannot proceed due to dependency/problem |

Never mark something DONE merely because it is planned.

---

## 5. MVP North Star

> The Traffic MVP is successful when we can spend money on an advertisement, send a stranger to the platform, capture that person as a lead, know where they came from, qualify them, and move them into the office pipeline while measuring the conversion journey.

This is more important than having every page or feature of the eventual platform.

---

## 6. Core Funnel

```
PAID AD → LANDING PAGE → LEAD CAPTURE → QUALIFICATION / EDUCATION → REGISTRATION / BUSINESS INTEREST → OFFICE MEETING → FOLLOW-UP → PROMOTER / BUSINESS BUILDER
```

**North-star measurement chain (architected now, refined later):**

`Ad spend → visitors → leads → qualified leads → registrations → meetings → attendance → promoters`

The first implementation does not need advanced analytics, but the architecture must not prevent this tracking.

---

## 7. Full Platform Vision (long-term — NOT the MVP)

The complete platform is expected to eventually include:

1. Public marketing website
2. Advertising landing pages
3. Lead generation
4. Advertising attribution
5. Lead qualification
6. CRM
7. Registration/application
8. Office meeting management
9. Follow-up
10. Promoter onboarding
11. Promoter dashboard
12. Customer management
13. Product management
14. Orders/sales
15. Referrals
16. Team/downline relationships
17. Training/business academy
18. Marketing resources
19. Business analytics
20. Commission-related architecture/calculation where appropriate
21. Administration
22. Security
23. Audit logging
24. Reporting
25. Notifications
26. Automation
27. Monitoring
28. Performance/scaling
29. Production deployment
30. Post-launch optimization

The architecture must account for future expansion without implementing all of it now.

---

## 8. MVP Strategy & Timeframe

**Not** "build everything → finish → launch." Instead:

**FULL PLATFORM BLUEPRINT → TRAFFIC MVP → LAUNCH PAID ADS → COLLECT REAL TRAFFIC/LEAD DATA → ITERATE → PROGRESSIVELY BUILD THE FULL PLATFORM**

Target MVP timeframe:

- Aggressive: ~2 weeks
- Preferred: ~3 weeks
- Upper target: ~4 weeks

Do NOT allow the MVP to expand into the full platform.

---

## 9. Phased Roadmap (overview)

| Phase | Name | Status |
|---|---|---|
| PHASE 0 | Project Foundation / Planning | 🟩 DONE (Owner authorization recorded 2026-09-08) |
| PHASE 1 | Traffic MVP | 🟩 COMPLETE (deployed — production LIVE) |
| PHASE 2 | Conversion & CRM Deepening | ⚪ NOT STARTED |
| PHASE 3 | Promoter System | ⚪ NOT STARTED |
| PHASE 4 | Commerce (Customer / Product / Orders) | ⚪ NOT STARTED |
| PHASE 5 | Network (Referrals / Team / Downline) | ⚪ NOT STARTED |
| PHASE 6 | Education & Marketing Resources | ⚪ NOT STARTED |
| PHASE 7 | Commission-related functionality | ⚪ NOT STARTED |
| PHASE 8 | Platform Operations (Automation / Notifications / Monitoring / Scaling / Hardening) | ⚪ NOT STARTED |

Cross-cutting concerns (security, audit logging, reporting) are introduced in Phase 0/1 and deepened throughout, rather than deferred wholesale.

---

## 10. PHASE 0 — Project Foundation / Planning

**Purpose:** establish the authoritative project plan, technology baseline, scope, and decisions before any implementation.

**Objectives:**

- Inspect the (greenfield) workspace.
- Establish the Master Project Plan (this document).
- Align Owner, ChatGPT, and Kilo on scope and strategy.
- Identify and schedule owner decisions.

**Tasks:**

- [x] Inspect workspace and environment (DONE — greenfield confirmed).
- [x] Draft and write the Master Project Plan (this document).
- [x] Owner + ChatGPT review and approve/revise the plan.
- [x] Owner authorization to begin Phase 1 recorded (2026-09-08).

**Dependencies:** none.

**Owner decisions required:** approval of this plan; the decisions in §19.

**Risks:** scope creep; premature technical commitment.

**Security requirements:** none beyond not exposing secrets during inspection.

**Testing requirements:** none (no code).

**Documentation requirements:** this `docs/PROJECT_PLAN.md`.

**Completion criteria:** Owner explicitly approves the written plan. — **MET (2026-09-08).**

**Current status:** 🟩 DONE — plan approved; Phase 1 authorized by Owner (see `docs/DECISIONS.md`, D-001).

**Next action:** Begin Phase 1 — record the approved technology decision, then foundation/scaffolding.

---

## 11. PHASE 1 — Traffic MVP

**Purpose:** create the smallest production-ready, measurable paid-advertising funnel that takes a stranger to a lead and moves them into the office pipeline.

**MVP North Star:** see §5.

### 11.1 🟢 REQUIRED FOR FIRST PAID-TRAFFIC LAUNCH

**Public side:**

- Professional business landing page
- Dedicated campaign landing-page capability (campaign-specific paths/destinations)
- Mobile-responsive experience
- Clear business opportunity presentation
- Appropriate disclosures (structure; final copy owner/legal-approved)
- Privacy / Terms / Disclaimer page structure

**Advertising & attribution:**

- UTM/source/campaign tracking
- First-touch source capture
- Landing-page attribution
- Conversion-event tracking (basic)

**Lead capture:**

- Lead form (Name, Phone, Email, qualification fields, consent)
- Server-side validation
- Consent handling
- Consent record + consent timestamp stored with each lead
- PII minimization — collect only Owner-approved fields; no unnecessary personal information
- Lead stored in database (with source/campaign)

**Qualification:**

- Basic qualification questionnaire
- Business vs product interest distinction
- Identify qualified prospects

**CRM / admin:**

- Secure admin authentication
- Lead status management
- Basic CRM/admin interface (view leads, view detail, update status, record follow-up, view campaign/source)

> The CRM lifecycle is the Owner-approved **initial model** (§19 item 4, `docs/DECISIONS.md` D-003). Do not hard-code business assumptions beyond the approved MVP requirement; statuses must remain data-driven and extensible.

**Registration & office pipeline:**

- Registration / business-interest tracking — records business interest and entry into the office pipeline. The platform is **NOT** the authoritative NeoLife distributor-registration system; it tracks interest and internal pipeline state only.
- Office meeting request/record
- Meeting date/time
- Meeting status/outcome
- Follow-up tracking

**Analytics:**

- First-party funnel event tracking (first-party events + attribution — this is NOT a custom analytics platform)
- Basic analytics (visitors, leads, lead source, conversion events) built on those first-party events

**Security & quality:**

- Secure admin authentication
- Basic security controls (input validation, CSRF/XSS/SQLi protections, rate limiting, bot/spam mitigation)
- Sensitive configuration protected

**Data protection (MVP baseline):**

- Data-retention policy for lead/event data (documented; enforced where practical)
- Lead correction/deletion mechanism (admin-accessible)
- Access control — lead data restricted to authenticated admin role
- Privacy context documented (what is collected, why, how long kept)

**Build & test:**

- Production build succeeds
- Unit + E2E testing sufficient for launch confidence

**Critical launch test:** `AD → LANDING PAGE → LEAD → QUALIFICATION → REGISTRATION → OFFICE PIPELINE → FOLLOW-UP` — we must be able to track this journey end-to-end.

### 11.2 ⚪ POST-LAUNCH ENHANCEMENTS (NOT in the critical launch path)

- Advanced CRM automation
- Sophisticated dashboards
- Automated WhatsApp
- Advanced notification infrastructure
- Promoter dashboard
- Customer portal
- Product catalogue
- Orders
- Team/downline
- Training academy
- Commission system
- Advanced BI
- Mobile app
- Advanced financial reporting
- Self-service calendar booking

These remain outside the MVP unless inspection proves a real architectural dependency exists.

### 11.3 Office scheduling — deliberately simple

For first launch, DO NOT build a sophisticated calendar-booking system.

Preferred MVP workflow:

```
Prospect submits interest → Lead enters CRM → Office/admin contacts prospect → Meeting date/time recorded → Attendance recorded → Outcome recorded → Follow-up
```

Self-service calendar booking is a later enhancement.

### 11.4 MVP completion criteria

MVP is NOT complete merely because pages exist. ALL of the following must be verified:

1. Application runs locally.
2. Public landing page works.
3. Lead capture works.
4. Lead reaches database/CRM.
5. Lead source can be tracked.
6. Qualification flow works.
7. Registration workflow works.
8. Office meeting workflow works.
9. Admin can view/manage leads.
10. Funnel events are measurable.
11. Mobile experience works.
12. Authentication is secure.
13. Input validation exists.
14. Sensitive configuration is protected.
15. Tests have been performed and passing.
16. Production build succeeds.
17. No known critical blockers.
18. Documentation is updated.
19. Project plan is updated.
20. Owner has reviewed/accepted the release.
21. Paid-traffic launch gate (§11.6) has been passed.

### 11.6 Paid-traffic launch gate (pre-advertising review)

Actual advertising must NOT go live until the following have been reviewed and accepted:

- Ad creative and claims (no guaranteed-income / misleading-earnings / unsupported medical claims)
- Disclosures and landing-page content (final approved copy in place)
- Consent and privacy implementation (consent capture, record, timestamp, privacy pages with approved content)
- Relevant compliance requirements (NeoLife rules; Kenya data-protection context)

This gate is an Owner (and where relevant legal) review step — a launch dependency, recorded in `docs/DECISIONS.md` when passed.

### 11.7 MVP Deployment Milestone

Once the public landing page has been implemented and passes its applicable local development and quality checks, the project may proceed to production deployment without waiting for the entire long-term platform to be completed.

**Deployment workflow:**

```
Local implementation
        ↓
Local testing
        ↓
Landing page / MVP launch-readiness verification
        ↓
Owner production deployment authorization
        ↓
Connect/configure owner's production server
        ↓
Configure domain/DNS/HTTPS/reverse proxy as required
        ↓
Configure production environment/secrets
        ↓
Deploy the approved build
        ↓
Production smoke testing
        ↓
Owner production review/acceptance
        ↓
Paid advertising launch
```

**Requirements:**

- Development remains local-first.
- Production infrastructure must remain isolated from local development.
- Production secrets must never be committed to the repository.
- The production server must be configured using the approved deployment architecture.
- Domain/DNS and HTTPS must be verified before public launch.
- Production environment variables must be configured securely.
- The deployed application must use the production database/configuration, not local development resources.
- A production smoke test must verify the actual deployed experience.
- Deployment must not introduce features outside the approved MVP scope.
- Paid advertising must not begin until the applicable production, compliance, tracking, and Owner launch gates have been satisfied.

**Important:** the ability to deploy the landing page early does NOT mean the complete NEOLIFE platform is finished. The landing page/MVP can be deployed as the first production slice while later platform capabilities continue to be developed progressively.

**Deployment status:** 🟩 **DEPLOYED — production is LIVE** at `https://neolife.ooflowdesk.com`, managed through the Owner's existing infrastructure (Docker Compose + Cloudflare Tunnel). See `docs/DEPLOYMENT.md` for the current production record and runbook.

### 11.5 Phase 1 attributes

**Dependencies:** Phase 0 approval; §19 "before coding" decisions for the relevant components.

**Owner decisions required:** stack, local DB, lead form fields, CRM statuses (before coding those components); hosting/domain, ad platforms, legal copy, meeting-model confirmation (before launch).

**Risks:** scope creep; ad-platform policy; conversion uncertainty; legal wording pending.

**Security requirements:** §15 baseline from the first commit (auth, validation, secrets, rate limiting, audit logging of funnel events).

**Testing requirements:** unit + E2E coverage of the critical launch path; production build verification.

**Documentation requirements:** keep this plan updated; add `STATUS.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `CHANGELOG.md` as implementation begins.

**Completion criteria:** §11.4 (all 20 items).

**Current status:** ⚪ NOT STARTED.

**Next action:** owner approval of this plan, then stack confirmation and project scaffolding.

---

## 12. Later Phases (progressive expansion after MVP launch)

### PHASE 2 — Conversion & CRM Deepening
**Purpose:** improve conversion and follow-up using real traffic/lead data.
Qualification automation, follow-up workflows, attribution/analytics depth, admin UX improvements.

### PHASE 3 — Promoter System
**Purpose:** onboard and support promoters/business builders.
Promoter onboarding, promoter dashboard, promoter tools.

### PHASE 4 — Commerce
**Purpose:** support customers and product sales.
Customer management, product catalogue, orders/sales.

### PHASE 5 — Network
**Purpose:** model relationships.
Referrals, team/downline relationships.

### PHASE 6 — Education & Marketing Resources
**Purpose:** enable training and marketing.
Training/business academy, marketing resources.

### PHASE 7 — Commission-related functionality
**Purpose:** compensation where appropriate (requires legal review).
Commission calculation architecture (carefully; owner/legal approval).

### PHASE 8 — Platform Operations
**Purpose:** scale and harden.
Notifications, automation, monitoring, performance/scaling, security hardening, admin/reporting enhancements, deployment optimization.

Each later phase will be fully specified (with its 11 attributes) before it begins.

---

## 13. Advertising & Attribution (from day one)

The architecture must support dedicated campaign destinations. Example:

```
Paid Advertisement → neolife.ooflowdesk.com/business → Business opportunity presentation → CTA → Lead capture → Qualification → CRM → Office follow-up
```

The exact URL remains an owner decision, but the system must support campaign-specific landing pages/paths.

**MVP attribution fields (minimum):** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, landing page/path, first-touch source (persisted to the lead), relevant conversion events.

Do NOT over-engineer attribution in Phase 1.

**Platforms to consider:** Meta/Facebook, Instagram, Google. MVP should at least support UTM + first-party conversion events; platform pixels (Meta Pixel, GA4) are recommended for MVP; deeper integrations later.

---

## 14. Legal / Trust / Compliance

The platform must avoid deceptive marketing. Plan for:

- Clear identification of the business relationship.
- Appropriate NeoLife disclosures.
- No guaranteed income claims.
- No misleading earnings representations.
- No unsupported medical/therapeutic claims.
- Appropriate privacy/consent mechanisms (awareness of Kenya Data Protection Act 2019).
- Appropriate Terms / Privacy / Disclaimer pages.

**Approach:**

- Do NOT invent NeoLife legal/compliance wording.
- Create the required page structures and placeholders where appropriate.
- Final approved content must be supplied/approved before paid advertising.

**Separation of concerns:**

- **Technical implementation** (page structures, routes, consent capture) — can proceed during development.
- **Owner/legal approval of content** — a **launch dependency**, not a blocker to early technical development.

🟨 **OWNER / LEGAL REVIEW REQUIRED** — exact NeoLife compliance wording and Kenya-specific legal text.

---

## 15. Security (built into the plan)

- Authentication (secure admin auth)
- Authorization / RBAC (admin role)
- Password/security controls
- Session security
- CSRF protection where applicable
- XSS protection
- SQL-injection protection (parameterized queries)
- Input validation (server-side)
- Rate limiting
- Bot/spam protection
- Secure secrets management (env vars; never committed)
- Audit logging (lead/funnel events)
- Data minimization
- Privacy
- Secure API design
- Database access controls
- Backup/recovery
- Dependency security
- Production configuration hardening

---

## 16. Local-First Development & Deployment

```
Local development → Local testing → MVP acceptance → Production deployment to owner's server → Paid advertising
```

- Development happens locally first.
- Production deployment does not happen immediately.
- Deployment requirements (Docker, reverse proxy, tunnel) are documented here and finalized in a later task; production is isolated from development.

**Definition of "production-ready":** for this project, production-ready means **MVP launch readiness** (§11.4) — a secure, tested, deployable Traffic MVP. It does NOT mean full-platform or enterprise completeness.

---

## 17. Independence from ZongFitness

NEOLIFE must be independently deployable and independently usable. It must NOT depend on ZongFitness for traffic, authentication, functionality, or operation.

The ecosystem may eventually allow controlled connections between NEOLIFE, ZongFitness, products, customers, business prospects, and promoters (e.g., a fitness customer later becomes a business prospect). These relationships are considered during architecture planning only — NOT implemented in this task.

---

## 18. Assumptions

- **KNOWN:** workspace is an empty greenfield directory; not a git repository; no server target defined.
- **ASSUMED:** owner has NEOLIFE business rights and will supply brand/compliance assets; Kenyan market is the primary target; paid ads are Meta/Instagram-led initially.
- **REQUIRES OWNER DECISION:** see §19.

---

## 19. Owner Decisions Required

> **Status note (2026-09-08):** Decisions 1–4 were Owner-approved together with plan acceptance and are recorded in `docs/DECISIONS.md` (D-001/D-002). Decisions 5–8 remain pre-launch decisions and do not block local development.

### 🟨 MUST DECIDE BEFORE CODING THE RELEVANT COMPONENT

1. **Technology stack** — recommended: Next.js 16 + React 19 + TypeScript + PostgreSQL 16 + Prisma 7 + Better Auth + Zod + Tailwind 4 + pnpm (matches the existing ecosystem). *Alternative:* simpler stack. Blocks: project scaffolding.
2. **Database for local dev** — recommended: local Docker PostgreSQL. *Alternative:* managed/hosted. Blocks: data-layer development (schema design can precede final DB choice).
3. **Lead form fields (exact)** — recommended: Name, Phone, Email, Country/City, interest type, consent. Blocks: lead capture component.
4. **CRM lead status set (exact)** — recommended: New Lead → Contacted → Qualified → Registered → Meeting Scheduled → Meeting Attended → Follow-Up → Converted / Not Interested (+ Disqualified). Blocks: CRM status workflow.

### 🟨 MUST DECIDE BEFORE PRODUCTION / PAID-TRAFFIC LAUNCH

5. **Hosting / domain target** — recommended: subdomain on existing infra (e.g., `neolife.ooflowdesk.com`) or dedicated domain. Blocks: production deployment only.
6. **Advertising platforms & tracking for MVP** — recommended: UTM + Meta Pixel + GA4. Blocks: paid-traffic launch measurement.
7. **Legal/compliance content** — owner/legal supplies or approves NeoLife disclosures, Terms, Privacy, Disclaimers. Blocks: paid-traffic launch (placeholders allowed during development).
8. **Meeting scheduling model (confirm simple workflow)** — recommended: office/admin-driven (prospect submits → office contacts). Blocks: final office workflow acceptance.

### 🟨 CAN BE DECIDED LATER (do not block MVP)

Promoter dashboard scope · commission rules · product catalogue structure · team/downline structure · training academy content model · notification channels (SMS/WhatsApp/email) · email/SMS provider · analytics tooling depth · referral program rules · self-service calendar booking.

---

## 20. Risks

- **Technical:** greenfield (everything new); integration with future phases.
- **Security:** spam/fake submissions; credential exposure; misconfigured production.
- **Business:** scope creep; over-engineering; delayed launch.
- **Advertising:** ad-platform policy/account risk from income/health claims; weak attribution.
- **Conversion:** unknown conversion rates until real traffic; mobile conversion quality.
- **Compliance:** NeoLife marketing rules; Kenya data protection; no invented claims.
- **Integration:** future NEOLIFE↔ZongFitness coupling done wrongly.
- **Performance:** landing page speed under paid traffic.

---

## 21. Future Kilo Workflow

After the owner approves this plan, every future implementation task must:

1. Read `docs/PROJECT_PLAN.md`.
2. Identify current phase, task, dependencies, required decisions, completion criteria.
3. Implement only approved scope.
4. Test the work.
5. Report files changed and tests performed.
6. Update `docs/PROJECT_PLAN.md` (statuses, next task, decisions).
7. Never mark a task DONE unless implemented and tested.

When a phase meets its completion criteria, explicitly report: **"PHASE X IS COMPLETE."**

---

## 22. Current Status

| Area | Status |
|---|---|
| Current phase | PHASE 1 — Traffic MVP |
| Plan document | 🟩 Written and updated with Owner clarifications |
| Owner authorization (Phase 1) | 🟩 Recorded 2026-09-08 (`docs/DECISIONS.md`) |
| Phase 0 completion | 🟩 DONE |
| Phase 1 (Traffic MVP) | 🟩 COMPLETE — all tasks 1.1–1.11 done; deployed to production |
| P-1 Registration / business-interest flow | 🟩 DONE (2026-09-18, D-026 + D-032) |
| P-2 Admin user management | 🟩 Implemented locally · 🟨 E2E validation in progress |
| Application implementation | Tasks 1.1 🟩 · 1.2 🟩 · 1.3 🟩 · 1.4 🟩 · 1.5 🟩 · 1.6 🟩 · 1.7 🟩 · 1.8 🟩 · 1.9 🟩 · 1.10 🟩 · 1.11 🟩 — see `docs/STATUS.md` |
| Production deployment | 🟩 LIVE — `https://neolife.ooflowdesk.com` |
| Test suite | 🟩 222/222 PASS (167 non-DB + 55 DB-enabled) · E2E 11 tests |

**Next action:** Complete P-2 admin user management E2E validation (the `admin-user-management` spec currently fails at the deactivation step). Paid advertising remains NOT AUTHORIZED and stays gated behind the §11.6 launch gate. See `docs/STATUS.md`.

---

*Full platform = the destination. Traffic MVP = the first launchable slice.*

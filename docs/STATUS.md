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

### Next tasks

- 1.2 Local PostgreSQL (Docker) + initial migration — ⚪ NOT STARTED
- 1.3 Public landing page (business opportunity, disclosures structure, CTAs) — ⚪ NOT STARTED
- 1.4 Campaign landing-page capability + UTM/attribution capture — ⚪ NOT STARTED
- 1.5 Lead capture (server-side validation, consent + timestamp, PII minimization) — ⚪ NOT STARTED
- 1.6 Qualification flow — ⚪ NOT STARTED
- 1.7 Admin auth (Better Auth) + CRM/admin interface — ⚪ NOT STARTED
- 1.8 Office pipeline (meeting record/status/outcome) + follow-up — ⚪ NOT STARTED
- 1.9 Funnel events + basic first-party analytics — ⚪ NOT STARTED
- 1.10 Privacy/Terms/Disclaimer structures (placeholder copy) — ⚪ NOT STARTED
- 1.11 Tests (unit + E2E critical path) — ⚪ NOT STARTED

**Pending pre-launch owner decisions (do not block local dev):** hosting/domain, ad platforms & tracking, final legal copy, meeting-model confirmation (§19, `DECISIONS.md`).

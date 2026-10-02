# NEOLIFE

A business platform for a direct-selling / network-marketing organisation, built to
capture inbound interest, qualify prospects, and manage the owner-and-staff relationship
that follows — from first visit through to an in-person office meeting.

The platform serves two audiences from one codebase:

- **Public** — a marketing site, product catalogue, and a registration / qualification
  funnel for prospective business builders.
- **Office / CRM** — an authenticated back office where the Owner and assigned Staff
  manage contacts, lead status, follow-ups, meetings, and account access.

> **Status:** Phase 1 (Traffic MVP) is implemented and deployed. See
> [`docs/STATUS.md`](docs/STATUS.md) for the current state.

---

## Technology stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React Server Components) |
| UI | React 19, TypeScript (strict), Tailwind CSS 4 |
| Database | PostgreSQL 16 via [Prisma 7](https://www.prisma.io) (`@prisma/adapter-pg`) |
| Authentication | [Better Auth](https://better-auth.com) 1.7.2 (email + password, cookie sessions) |
| Validation | Zod |
| Unit / integration tests | [Vitest](https://vitest.dev) |
| End-to-end tests | [Playwright](https://playwright.dev) (system Chrome) |
| Linting | ESLint 9 + typescript-eslint |
| Package manager | [pnpm](https://pnpm.io) |
| Deployment | Docker + Docker Compose, published app behind a CDN tunnel |

---

## Local development

### Prerequisites

- Node.js 24 or newer
- pnpm 10 or newer
- Docker (for the local PostgreSQL instance)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure the environment
cp .env.example .env
#    Set DATABASE_URL and BETTER_AUTH_SECRET in .env (see .env.example).

# 3. Start the local database
docker compose up -d

# 4. Apply database migrations
pnpm exec prisma migrate deploy
pnpm prisma:generate

# 5. Create an Owner account (and optionally Staff accounts)
ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='<12+ char password>' \
  pnpm exec tsx scripts/seed-admin.ts

STAFF_EMAIL='colleague@example.com' STAFF_PASSWORD='<12+ char password>' \
STAFF_NAME='Colleague' pnpm exec tsx scripts/seed-staff.ts

# 6. Start the dev server
pnpm dev
```

The application is then available at <http://localhost:3000>. The office sign-in page
is at `/admin/login`.

### Common commands

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| Production build | `pnpm build` |
| Start production build | `node .next/standalone/server.js` |
| Lint | `pnpm lint` |
| Type-check | `pnpm typecheck` |
| Unit + DB tests | `pnpm test` |
| E2E tests | `pnpm exec playwright test` |
| Prisma client | `pnpm prisma:generate` |
| Apply migrations | `pnpm exec prisma migrate deploy` |

---

## Testing

The suite contains **247 tests**:

- **179** unit / pure-logic tests that run with no database.
- **68** additional DB-enabled tests that require a local PostgreSQL instance.

DB-dependent suites gate on the presence of `DATABASE_URL`, so a run without it reports
179 tests and is not a failure. Note that `vitest` does not load `.env` automatically
(Next.js does) — export `DATABASE_URL` **and** `BETTER_AUTH_SECRET` explicitly to include
the DB-enabled tests.

```bash
docker compose up -d
DATABASE_URL="postgresql://<user>:<password>@localhost:5433/neolife?schema=public" \
BETTER_AUTH_SECRET="<a local-only value of 16+ characters>" pnpm test
```

End-to-end tests use Playwright against **system Chrome** (no browser download needed).
Build first, then run:

```bash
pnpm build
pnpm exec playwright test
```

The test harness prepares its own runtime and fixtures: it copies the static assets the
standalone build omits, starts a local server that refuses to reuse an already-running
service on port 3000, and resets two local test accounts before the run. Seeding is
restricted to a loopback database and never runs against production.

---

## Documentation

Detailed project documentation lives in [`docs/`](docs/):

| Document | Purpose |
|---|---|
| [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) | **Authoritative** scope, phases, and completion rules |
| [`docs/STATUS.md`](docs/STATUS.md) | Current state summary, then dated milestone history |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Data model, authorization model, and request flows |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Owner-approved decision log (D-001 …) |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Change history, including unreleased work |
| [`docs/RECOVERY.md`](docs/RECOVERY.md) | Recovery runbook and health checks |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deployment runbook and production configuration spec |
| [`docs/DEPLOYMENT_EXECUTION_PLAN.md`](docs/DEPLOYMENT_EXECUTION_PLAN.md) | Historical record of the initial deployment |
| [`docs/PRODUCT_CATALOGUE_PLAN.md`](docs/PRODUCT_CATALOGUE_PLAN.md) | Product catalogue data plan |
| [`docs/DESIGN_UPGRADE_PLAN.md`](docs/DESIGN_UPGRADE_PLAN.md) | Visual and conversion upgrade plan |
| [`docs/CATEGORY_IMAGE_SOURCES.md`](docs/CATEGORY_IMAGE_SOURCES.md) | Category image provenance |

[`AGENTS.md`](AGENTS.md) contains the development conventions and the pre-commit
checklist for contributors and automated agents.

---

## Security

- **No secrets are committed to this repository.** `.env`, `.env*.local`, and
  `.env.production` are gitignored and have never appeared in the commit history.
- **`.env.example` contains placeholders only** (`CHANGE_ME` and empty strings) and
  documents every variable the application expects.
- **Production configuration is never stored in the repository.** The production
  compose files interpolate variables such as `${DATABASE_URL}` and `${TUNNEL_TOKEN}`
  and contain no literal secret values. Secrets are supplied to the runtime
  separately and must never be printed, logged, committed, or pasted into issues.
- **Credentials are never stored in plaintext by the application.** Passwords are
  hashed by Better Auth; role and activation state are server-controlled fields that
  clients cannot set.
- **Authorization is enforced server-side** on every CRM route and Server Action.
  Report suspected vulnerabilities privately to the maintainers rather than opening a
  public issue.

If you discover a credential that has been exposed, rotate it immediately and treat it
as compromised.

---

## License

All rights reserved. This repository is the internal source of truth for the NEOLIFE
project and its maintainers.

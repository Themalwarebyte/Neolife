# AGENTS.md — NEOLIFE

## Package manager

This project uses **pnpm** (see `pnpm-lock.yaml` / `pnpm-workspace.yaml`). Do not use
`npm` or `yarn`, and do not introduce a second lockfile. All commands below assume pnpm.

## Development commands

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Lint | `pnpm lint` (strict gate: `pnpm exec eslint . --max-warnings 0`) |
| Type-check | `pnpm typecheck` |
| Unit + DB tests | `pnpm test` |
| Single test file | `pnpm exec vitest run tests/<file>.test.ts` |
| E2E tests | `pnpm exec playwright test` (requires a running server + PostgreSQL) |
| Dev server | `pnpm dev` — `http://localhost:3000` |
| Production build | `pnpm build` |
| Start production | `node .next/standalone/server.js` |
| Prisma generate | `pnpm prisma:generate` |
| Prisma migrate (local dev) | `pnpm prisma:migrate:dev` |
| Prisma migrate (apply, e.g. prod) | `pnpm exec prisma migrate deploy` |
| Prisma validate | `pnpm prisma:validate` |
| Seed Owner | `ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm exec tsx scripts/seed-admin.ts` |
| Seed Staff | `STAFF_EMAIL=… STAFF_PASSWORD=… STAFF_NAME=… pnpm exec tsx scripts/seed-staff.ts` |

## Testing conventions

- **Official total: 222 tests** — **167** run without `DATABASE_URL`, plus **55**
  DB-enabled tests that require a local PostgreSQL instance.
- DB-dependent suites gate on `const DB_AVAILABLE = Boolean(process.env.DATABASE_URL)`.
  A run without that variable legitimately reports fewer tests; that is not a failure.
- `vitest` and `tsx` do **not** auto-load `.env`. Next.js does. To run DB-enabled
  tests from a bare shell, export `DATABASE_URL` explicitly.
- E2E runs against **system Chrome** (`channel: "chrome"`); no browser download needed.
  `e2e/global-setup.ts` creates shared Owner/Staff sessions in `test-results/`.

## Architecture notes

- **Test runner:** Vitest (not Jest). Unit tests in `tests/`, E2E in `e2e/`.
- **E2E runner:** Playwright with system Chrome (`playwright.config.ts`).
- **Project type:** `"type": "module"` — use `import/export`, not `require()`.
- **Aliases:** `@/` maps to `src/` (configured in both `tsconfig.json` and `vitest.config.ts`).
- **Database:** PostgreSQL 16 via Prisma. Local dev uses `docker compose up -d`.
  Schema changes require a new migration; never edit an applied migration.
- **Auth:** Better Auth 1.7.2 with `@/lib/auth.ts`. Server-side session checks via
  `src/server/auth/requireCrmUser.ts` (`getCrmUser`, `requireCrmUser`, `requireAdmin`).
- **Server Actions:** marked `"use server"`. Guard with `await requireAdmin()` or
  `await requireCrmUser()`. Never trust role/assignment values from client input —
  `role` and `isActive` are Better Auth `additionalFields` with `input: false`.
- **Production:** live at `https://neolife.ooflowdesk.com`. See `docs/DEPLOYMENT.md`.
  Secrets are never committed and must never be printed or logged.

## Documentation

- `README.md` — public project entry point.
- `docs/PROJECT_PLAN.md` — authoritative scope, phase, and completion rules.
- `docs/STATUS.md` — start with the **Current State Summary** at the top; entries below
  it are dated history.
- `docs/DECISIONS.md` — Owner-approved decisions. Append dated clarifications; do not
  rewrite historical decisions.
- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/RECOVERY.md`,
  `docs/DEPLOYMENT_EXECUTION_PLAN.md`, `docs/CHANGELOG.md`.
- Update documentation in the same change as the behaviour it describes. When work
  changes a documented number, state the new authoritative figure and mark the old one
  superseded rather than silently editing it.

## CI / pre-commit checklist

1. `pnpm typecheck` — must pass
2. `pnpm exec eslint . --max-warnings 0` — must pass
3. `pnpm test` — all non-DB tests must pass (167); DB tests skip without `DATABASE_URL`
   (55) and must pass when PostgreSQL is available (222 total)
4. Confirm no secrets, credentials, or production configuration are staged
